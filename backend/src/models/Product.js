const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Product = sequelize.define('Product', {
  name: { type: DataTypes.STRING, allowNull: false },
  sku: { type: DataTypes.STRING, allowNull: false, unique: true },
  description: { type: DataTypes.TEXT },
  category_id: { type: DataTypes.INTEGER, references: { model: 'Categories', key: 'id' } },
  brand_id: { type: DataTypes.INTEGER, references: { model: 'Brands', key: 'id' } },
  barcode: { type: DataTypes.STRING, allowNull: true },
  specifications: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.STRING, defaultValue: 'active', allowNull: false },
  supplier_id: { type: DataTypes.INTEGER, references: { model: 'Suppliers', key: 'id' } },
  price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  last_purchase_price: { type: DataTypes.DECIMAL(10, 2) },
  image_url: { type: DataTypes.STRING },
  product_image: { type: DataTypes.STRING },
  is_bundle: { type: DataTypes.BOOLEAN, defaultValue: false },
  max_request_quantity: { type: DataTypes.INTEGER, allowNull: true },
  min_request_quantity: { type: DataTypes.INTEGER, allowNull: true },
  available_quantity: { type: DataTypes.INTEGER, defaultValue: 100 },
  reserved_quantity: { type: DataTypes.INTEGER, defaultValue: 0 },
  branch_id: { type: DataTypes.INTEGER, references: { model: 'Branches', key: 'id' } }
}, {
  paranoid: true,
  deletedAt: 'deleted_at',
  timestamps: true
});

Product.prototype.toJSON = function () {
  const values = Object.assign({}, this.get());
  const rawImage = values.image_url || values.product_image || null;
  values.image = rawImage;
  values.image_url = values.image_url || rawImage;
  values.product_image = values.product_image || rawImage;
  if (rawImage && rawImage.includes('/uploads/products/')) {
    const cleanPrefix = rawImage.replace(/(_original|_medium|_thumbnail)?\.webp$/, '');
    values.thumbnail_url = `${cleanPrefix}_thumbnail.webp`;
  } else {
    values.thumbnail_url = rawImage;
  }
  return values;
};

module.exports = Product;
