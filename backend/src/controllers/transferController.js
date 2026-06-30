const { StockTransfer, StockTransferItem, Branch, Product, Inventory, User, Notification } = require('../models');
const { Op } = require('sequelize');
const { completeStockTransfer } = require('../services/transferService');

const getAllTransfers = async (req, res) => {
  try {
    const branchId = req.user.role !== 'super_admin' ? req.user.branch_id : req.query.branchId;
    const where = {};

    if (branchId) {
      where[Op.or] = [
        { fromBranchId: branchId },
        { toBranchId: branchId }
      ];
    }

    const transfers = await StockTransfer.findAll({
      where,
      include: [
        { model: Branch, as: 'SourceBranch', attributes: ['name'] },
        { model: Branch, as: 'DestBranch', attributes: ['name'] }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(transfers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getTransferById = async (req, res) => {
  try {
    const transfer = await StockTransfer.findByPk(req.params.id, {
      include: [
        { model: Branch, as: 'SourceBranch', attributes: ['name'] },
        { model: Branch, as: 'DestBranch', attributes: ['name'] },
        {
          model: StockTransferItem,
          include: [{ model: Product, attributes: ['name', 'sku'] }]
        }
      ]
    });
    if (!transfer) return res.status(404).json({ message: 'Stock Transfer not found.' });

    // Validate branch authorization
    if (req.user.role !== 'super_admin' && transfer.fromBranchId !== req.user.branch_id && transfer.toBranchId !== req.user.branch_id) {
      return res.status(403).json({ message: 'Forbidden: You cannot access stock transfers outside your branch.' });
    }

    res.json(transfer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createTransfer = async (req, res) => {
  try {
    const { fromBranchId, toBranchId, items, notes } = req.body;

    // Both source and destination branch users may create a transfer request (as well as super_admin).
    // A destination branch (e.g. Calamba) requests stock FROM a source branch (e.g. Sta. Rosa).
    const userBranchId = req.user.branch_id;
    if (
      req.user.role !== 'super_admin' &&
      parseInt(fromBranchId) !== userBranchId &&
      parseInt(toBranchId) !== userBranchId
    ) {
      return res.status(403).json({ message: 'Forbidden: You can only create transfers involving your own branch.' });
    }

    // --- Source Stock Validation ---
    for (const item of items) {
      const sourceInventory = await Inventory.findOne({
        where: { product_id: item.productId, branch_id: fromBranchId }
      });

      if (!sourceInventory || sourceInventory.quantity < item.quantity) {
        const available = sourceInventory ? sourceInventory.quantity : 0;
        const product = await Product.findByPk(item.productId, { attributes: ['name'] });
        const productName = product ? product.name : `Product #${item.productId}`;
        return res.status(400).json({
          message: `Insufficient stock for "${productName}" at the source branch. Available: ${available}, Requested: ${item.quantity}.`
        });
      }
    }

    const transfer = await StockTransfer.create({
      fromBranchId,
      toBranchId,
      status: 'Pending',
      notes
    });

    for (const item of items) {
      await StockTransferItem.create({
        transferId: transfer.id,
        productId: item.productId,
        quantity: item.quantity
      });
    }

    // --- Notify all users at the SOURCE branch (fromBranchId) to review and act on the request ---
    const [sourceBranchUsers, destBranch] = await Promise.all([
      User.findAll({
        where: {
          branch_id: fromBranchId,
          role: { [Op.in]: ['branch_admin', 'employee'] }
        }
      }),
      Branch.findByPk(toBranchId, { attributes: ['name'] })
    ]);

    // Also notify super_admins
    const superAdmins = await User.findAll({ where: { role: 'super_admin' } });
    const allRecipients = [...sourceBranchUsers, ...superAdmins];

    const productSummary = items.length === 1
      ? `${items[0].quantity} unit(s) of 1 product`
      : `${items.length} product(s)`;

    if (allRecipients.length > 0) {
      await Notification.bulkCreate(
        allRecipients.map(u => ({
          userId: u.id,
          branchId: fromBranchId,
          title: 'Incoming Stock Transfer Request',
          message: `Branch "${destBranch?.name || `#${toBranchId}`}" is requesting ${productSummary} from your branch. Please review and approve or reject.`,
          type: 'stock_transfer',
          link: `/admin?tab=transfers&id=${transfer.id}`
        }))
      );
    }

    res.status(201).json(transfer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Approve a pending stock transfer.
 * Only the SOURCE branch (fromBranchId) users or super_admin can approve.
 * Deducts from source, adds to destination, notifies destination branch.
 */
const approveTransfer = async (req, res) => {
  try {
    const transfer = await StockTransfer.findByPk(req.params.id);
    if (!transfer) return res.status(404).json({ message: 'Stock Transfer not found.' });

    if (transfer.status !== 'Pending') {
      return res.status(400).json({ message: `Transfer is already ${transfer.status}.` });
    }

    // Only the SOURCE branch or super_admin can approve
    if (req.user.role !== 'super_admin' && transfer.fromBranchId !== req.user.branch_id) {
      return res.status(403).json({ message: 'Forbidden: Only the source branch can approve this stock transfer.' });
    }

    const completedTransfer = await completeStockTransfer(
      req.params.id,
      req.user.id,
      req.ip || req.connection.remoteAddress
    );

    // Notify all users at the DESTINATION branch (toBranchId)
    const [destBranchUsers, sourceBranch] = await Promise.all([
      User.findAll({
        where: {
          branch_id: transfer.toBranchId,
          role: { [Op.in]: ['branch_admin', 'employee'] }
        }
      }),
      Branch.findByPk(transfer.fromBranchId, { attributes: ['name'] })
    ]);

    if (destBranchUsers.length > 0) {
      await Notification.bulkCreate(
        destBranchUsers.map(u => ({
          userId: u.id,
          branchId: transfer.toBranchId,
          title: 'Stock Transfer Approved',
          message: `Stock Transfer #${transfer.id} from branch "${sourceBranch?.name || `#${transfer.fromBranchId}`}" has been approved. Your inventory has been updated.`,
          type: 'success',
          link: '/inventory'
        }))
      );
    }

    // Remove the original pending request notification
    await Notification.destroy({
      where: { link: `/admin?tab=transfers&id=${transfer.id}` }
    });

    res.json({ message: 'Stock Transfer approved and inventory updated.', transfer: completedTransfer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Reject a pending stock transfer.
 * Only the SOURCE branch (fromBranchId) users or super_admin can reject.
 * Notifies destination branch with the rejection reason.
 */
const rejectTransfer = async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ message: 'Rejection reason must be at least 10 characters.' });
    }

    const transfer = await StockTransfer.findByPk(req.params.id);
    if (!transfer) return res.status(404).json({ message: 'Stock Transfer not found.' });

    if (transfer.status !== 'Pending') {
      return res.status(400).json({ message: `Transfer is already ${transfer.status}.` });
    }

    // Only the SOURCE branch or super_admin can reject
    if (req.user.role !== 'super_admin' && transfer.fromBranchId !== req.user.branch_id) {
      return res.status(403).json({ message: 'Forbidden: Only the source branch can reject this stock transfer.' });
    }

    transfer.status = 'Rejected';
    transfer.rejection_reason = reason.trim();
    transfer.processed_at = new Date();
    await transfer.save();

    // Notify all users at the DESTINATION branch (toBranchId)
    const [destBranchUsers, sourceBranch] = await Promise.all([
      User.findAll({
        where: {
          branch_id: transfer.toBranchId,
          role: { [Op.in]: ['branch_admin', 'employee'] }
        }
      }),
      Branch.findByPk(transfer.fromBranchId, { attributes: ['name'] })
    ]);

    if (destBranchUsers.length > 0) {
      await Notification.bulkCreate(
        destBranchUsers.map(u => ({
          userId: u.id,
          branchId: transfer.toBranchId,
          title: 'Stock Transfer Rejected',
          message: `Stock Transfer #${transfer.id} requested from branch "${sourceBranch?.name || `#${transfer.fromBranchId}`}" was rejected. Reason: ${reason.trim()}`,
          type: 'error',
          link: `/transfers`
        }))
      );
    }

    // Remove the original pending request notification
    await Notification.destroy({
      where: { link: `/admin?tab=transfers&id=${transfer.id}` }
    });

    res.json({ message: 'Stock Transfer rejected.', transfer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getAllTransfers,
  getTransferById,
  createTransfer,
  approveTransfer,
  rejectTransfer
};
