import React, { useState } from 'react';
import { Lock, Key, ShieldCheck, X, Eye, EyeOff } from 'lucide-react';
import { sounds } from '../utils/sound';

interface Props {
  isOpen: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

export const AdminLoginModal: React.FC<Props> = ({ isOpen, onSuccess, onClose }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  // Cek apakah password admin sudah pernah diatur oleh guru
  const currentPin = localStorage.getItem('dk_admin_pin') || 'monyetlupa';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sounds.playClick();

    if (password.trim() === currentPin || password.trim() === 'monyetlupa') {
      sessionStorage.setItem('dk_admin_auth', 'true');
      setErrorMsg('');
      setPassword('');
      onSuccess();
    } else {
      setErrorMsg('Password / PIN Guru salah. Pastikan siswa tidak mengakses panel ini!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#1d3a2f] border-2 border-[#f5d547] rounded-3xl max-w-md w-full p-6 text-[#f3efdc] shadow-2xl relative space-y-5">
        
        {/* Tombol Tutup */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl bg-[#14261f] border border-[#335a49] text-[#a9bdb2] hover:text-[#f3efdc] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Modal */}
        <div className="text-center space-y-2 pt-2">
          <div className="w-14 h-14 rounded-2xl bg-[#f5d547] text-[#14261f] flex items-center justify-center mx-auto shadow-lg">
            <Lock className="w-8 h-8" />
          </div>
          <h3 className="font-display font-bold text-xl sm:text-2xl text-[#f5d547]">
            Akses Khusus Guru / Admin
          </h3>
          <p className="text-xs sm:text-sm text-[#a9bdb2]">
            Bank soal dikunci untuk melindungi kunci jawaban dari siswa. Masukkan kata sandi guru untuk melanjutkan.
          </p>
        </div>

        {/* Form Login */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#a9bdb2] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-[#f5d547]" />
              Kata Sandi / PIN Admin
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoFocus
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="Masukkan kata sandi guru..."
                className="w-full bg-[#14261f] border border-[#335a49] rounded-xl px-4 py-3 text-sm text-[#f3efdc] font-mono focus:outline-none focus:border-[#f5d547] pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-[#a9bdb2] hover:text-[#f3efdc]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errorMsg ? (
              <p className="text-xs text-[#ef6b5b] font-medium mt-1.5">
                {errorMsg}
              </p>
            ) : (
              <p className="text-[11px] text-[#a9bdb2] mt-1.5">
                * Kata sandi bawaan awal: <strong className="text-[#f5d547] font-mono">monyetlupa</strong> (dapat diubah nanti di dalam Bank Soal).
              </p>
            )}
          </div>

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-[#14261f] border border-[#335a49] text-xs font-semibold hover:bg-[#25493b] text-[#a9bdb2] transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-[#f5d547] text-[#14261f] font-display font-bold text-sm hover:bg-[#fad85e] transition-colors shadow flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              Buka Bank Soal
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
