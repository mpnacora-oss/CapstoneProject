// src/app/reports/stock/HistoryModal.js
"use client";

import { useState, useEffect } from "react";
import { X, Clock, Calendar, User, Info, Building, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiUrl } from "@/lib/api";

export default function HistoryModal({ product, isOpen, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !product?.id) return;

    const fetchHistory = async () => {
      setLoading(true);
      const token = localStorage.getItem("token");
      try {
        const branchParam = product.branch_id ? `?branch_id=${product.branch_id}` : '';
        const res = await fetch(apiUrl(`/api/inventory/${product.id}/history${branchParam}`), {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setHistory(data);
        }
      } catch (err) {
        console.error("Failed to load stock history:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [isOpen, product]);

  if (!isOpen) return null;

  const getMovementTypeBadge = (type) => {
    switch (type) {
      case "RESTOCK":
        return "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
      case "SALE":
        return "bg-sky-500/10 border-sky-500/20 text-sky-400";
      case "ADJUSTMENT":
        return "bg-amber-500/10 border-amber-500/20 text-amber-400";
      case "TRANSFER":
        return "bg-purple-500/10 border-purple-500/20 text-purple-400";
      default:
        return "bg-muted/10 border-border/20 text-muted";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-brand-surface border border-brand-neonblue/30 rounded-[32px] p-6 lg:p-8 max-w-4xl w-full shadow-2xl relative overflow-hidden max-h-[85vh] flex flex-col"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-neonblue/5 blur-[100px] pointer-events-none" />

        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <span className="text-[9px] font-black tracking-[4px] uppercase text-brand-neonblue/60 mb-1.5 block">Audit Trail</span>
            <h2 className="text-2xl font-rajdhani font-black uppercase text-main leading-none">Stock History</h2>
            <p className="text-xs text-brand-muted mt-2 font-medium">
              Product: <span className="text-main font-bold">{product?.name}</span> • SKU: <span className="text-main font-mono">{product?.sku}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-main w-8 h-8 rounded-full bg-brand-panel flex items-center justify-center border border-border/40 hover:bg-brand-hover transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Table/List area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-[300px] border border-border/30 rounded-2xl bg-brand-panel/30 overflow-x-auto">
          {loading ? (
            <div className="h-full flex items-center justify-center flex-col py-16">
              <div className="w-8 h-8 border-2 border-t-brand-neonblue rounded-full animate-spin mb-4" />
              <p className="text-xs text-brand-muted uppercase tracking-widest font-black">Retrieving audit records...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="h-full flex items-center justify-center flex-col py-16 text-center">
              <Clock size={40} className="text-brand-muted/40 mb-3" />
              <p className="text-xs font-black uppercase tracking-widest text-brand-muted">No stock movement history found</p>
              <p className="text-[10px] text-brand-muted/60 mt-1 max-w-xs">Actions like restocks, sales, and adjustments will be tracked here.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse whitespace-nowrap min-w-[700px]">
              <thead>
                <tr className="bg-brand-bgbase/40 text-[9px] font-black uppercase tracking-wider text-muted border-b border-border/30 sticky top-0 z-20">
                  <th className="py-3.5 px-5">Date & Time</th>
                  <th className="py-3.5 px-4">Branch</th>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4 text-right">Qty Change</th>
                  <th className="py-3.5 px-4 text-right">Previous → New</th>
                  <th className="py-3.5 px-4">Initiated By</th>
                  <th className="py-3.5 px-5">Notes</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, idx) => {
                  const isPositive = item.quantity > 0;
                  const formattedDate = new Date(item.createdAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  });
                  const actor = item.User 
                    ? `${item.User.first_name || ''} ${item.User.last_name || ''} (${item.User.username})`
                    : 'System Auto';

                  return (
                    <tr key={item.id} className="border-b border-border/10 text-xs hover:bg-brand-bgbase/20 transition-colors">
                      <td className="py-3.5 px-5 text-muted font-medium flex items-center gap-2">
                        <Calendar size={12} className="text-brand-muted/60" />
                        {formattedDate}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-main">
                        <span className="flex items-center gap-1.5">
                          <Building size={12} className="text-brand-neonblue/60" />
                          {item.Branch?.name || `Branch #${item.branch_id || 'All'}`}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-wider border ${getMovementTypeBadge(item.type)}`}>
                          {item.type}
                        </span>
                      </td>
                      <td className={`py-3.5 px-4 text-right font-black font-mono ${isPositive ? 'text-emerald-400' : 'text-brand-crimson'}`}>
                        {isPositive ? `+${item.quantity}` : item.quantity}
                      </td>
                      <td className="py-3.5 px-4 text-right text-muted font-semibold font-mono">
                        {item.previous_stock} → {item.new_stock}
                      </td>
                      <td className="py-3.5 px-4 text-muted flex items-center gap-1.5">
                        <User size={12} className="text-brand-muted/60" />
                        {actor}
                      </td>
                      <td className="py-3.5 px-5 text-muted max-w-[200px] truncate" title={item.note}>
                        {item.note || '---'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl bg-brand-surface hover:bg-brand-hover text-[10px] font-black uppercase tracking-[0.2em] font-rajdhani text-main border border-border transition-colors">
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
