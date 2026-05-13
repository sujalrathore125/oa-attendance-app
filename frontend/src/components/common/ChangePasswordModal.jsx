import { useState } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { FiLock, FiEye, FiEyeOff, FiX } from 'react-icons/fi';

const ChangePasswordModal = ({ onClose }) => {
  const [form, setForm] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [loading, setLoading] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.new_password !== form.confirm_password) {
      return toast.error('New passwords do not match');
    }
    if (form.new_password.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }
    setLoading(true);
    try {
      await api.patch('/auth/change-password', {
        old_password: form.old_password,
        new_password: form.new_password,
      });
      toast.success('Password changed successfully!');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>
        {`
          .animate-fade-in { opacity: 0; animation: fadeIn 0.4s ease-out forwards; }
          .animate-slide-up { opacity: 0; animation: slideUp 0.4s ease-out forwards; }
          
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" 
          onClick={onClose} 
        />
        
        {/* Modal Content */}
        <div className="bg-[#1d2d44] border border-white/10 rounded-[2rem] shadow-2xl w-full max-w-md relative z-10 overflow-hidden animate-slide-up">
          <div className="p-6 md:p-8">
            
            {/* Close Button */}
            <button
              className="absolute right-6 top-6 text-gray-400 hover:text-white transition-colors"
              onClick={onClose}
            >
              <FiX size={24} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#f26644] to-[#c44536] flex items-center justify-center shrink-0 shadow-lg shadow-[#f26644]/20">
                <FiLock size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-xl text-white">Change Password</h3>
                <p className="text-gray-400 text-xs mt-1">Update your account security</p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Current Password */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2">
                  Current Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500">
                    <FiLock size={16} />
                  </div>
                  <input
                    type={showOld ? 'text' : 'password'}
                    placeholder="Enter current password"
                    className="w-full bg-[#0d1321]/80 border border-white/10 text-white rounded-xl py-3 pl-10 pr-12 focus:outline-none focus:border-[#f26644]/50 focus:ring-1 focus:ring-[#f26644]/50 transition-all placeholder-gray-600 text-sm"
                    value={form.old_password}
                    onChange={e => setForm(p => ({ ...p, old_password: e.target.value }))}
                    required
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowOld(p => !p)} 
                    className="absolute inset-y-0 right-4 flex items-center text-gray-500 hover:text-white transition-colors"
                  >
                    {showOld ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500">
                    <FiLock size={16} />
                  </div>
                  <input
                    type={showNew ? 'text' : 'password'}
                    placeholder="Min 6 characters"
                    className="w-full bg-[#0d1321]/80 border border-white/10 text-white rounded-xl py-3 pl-10 pr-12 focus:outline-none focus:border-[#f26644]/50 focus:ring-1 focus:ring-[#f26644]/50 transition-all placeholder-gray-600 text-sm"
                    value={form.new_password}
                    onChange={e => setForm(p => ({ ...p, new_password: e.target.value }))}
                    required
                    minLength={6}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowNew(p => !p)} 
                    className="absolute inset-y-0 right-4 flex items-center text-gray-500 hover:text-white transition-colors"
                  >
                    {showNew ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500">
                    <FiLock size={16} />
                  </div>
                  <input
                    type="password"
                    placeholder="Re-enter new password"
                    className="w-full bg-[#0d1321]/80 border border-white/10 text-white rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-[#f26644]/50 focus:ring-1 focus:ring-[#f26644]/50 transition-all placeholder-gray-600 text-sm"
                    value={form.confirm_password}
                    onChange={e => setForm(p => ({ ...p, confirm_password: e.target.value }))}
                    required
                    minLength={6}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-6 mt-2 border-t border-white/10">
                <button 
                  type="button" 
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3.5 rounded-xl font-medium transition-colors text-sm border border-white/10" 
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-[#f26644] hover:bg-[#e05535] text-white py-3.5 rounded-xl font-bold transition-all shadow-lg flex justify-center items-center text-sm disabled:opacity-70 disabled:cursor-not-allowed" 
                  disabled={loading}
                >
                  {loading ? (
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    'Update Password'
                  )}
                </button>
              </div>
              
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default ChangePasswordModal;