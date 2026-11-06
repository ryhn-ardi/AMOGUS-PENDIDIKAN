import React, { useState } from 'react';
import { Question } from '../types/game';
import { DEFAULT_QUESTIONS } from '../data/defaultQuestions';
import { PRESET_QUESTION_PACKS } from '../data/questionPacks';
import { 
  downloadExcelTemplate, 
  downloadCsvTemplate, 
  downloadJsonTemplate, 
  parseQuestionsFromFile 
} from '../utils/questionTemplates';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Edit3, 
  Upload, 
  Download, 
  RotateCcw, 
  CheckCircle, 
  AlertCircle, 
  FileSpreadsheet,
  FileText,
  Sparkles,
  Shuffle,
  BookOpen,
  Layers,
  HelpCircle
} from 'lucide-react';

interface Props {
  questions: Question[];
  onSaveQuestions: (questions: Question[]) => void;
  onBack: () => void;
}

export const QuestionEditor: React.FC<Props> = ({ questions, onSaveQuestions, onBack }) => {
  const [list, setList] = useState<Question[]>(questions);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState<string[]>(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState<number>(0);
  const [subject, setSubject] = useState<string>('Umum');
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [activeTab, setActiveTab] = useState<'list' | 'templates' | 'import_export'>('list');

  const resetForm = () => {
    setEditingIndex(null);
    setQuestionText('');
    setOptions(['', '', '', '']);
    setCorrectIndex(0);
    setSubject('Umum');
    setErrorMsg('');
  };

  const handleStartEdit = (idx: number) => {
    const item = list[idx];
    setEditingIndex(idx);
    setQuestionText(item.q);
    setOptions([
      item.o[0] || '',
      item.o[1] || '',
      item.o[2] || '',
      item.o[3] || ''
    ]);
    setCorrectIndex(item.a);
    setSubject(item.subject || 'Umum');
    setErrorMsg('');
    setActiveTab('list');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveQuestion = () => {
    const q = questionText.trim();
    if (!q) {
      setErrorMsg('Pertanyaan wajib diisi.');
      return;
    }

    const filledOptions = options.map(o => o.trim()).filter(Boolean);
    if (filledOptions.length < 2) {
      setErrorMsg('Minimal harus ada 2 pilihan jawaban yang terisi.');
      return;
    }

    if (correctIndex < 0 || correctIndex >= options.length || !options[correctIndex].trim()) {
      setErrorMsg('Pilih jawaban benar dari pilihan yang sudah diisi.');
      return;
    }

    const targetAnswerText = options[correctIndex].trim();
    const cleanAnswerIndex = filledOptions.indexOf(targetAnswerText);

    const newQuestion: Question = {
      q,
      o: filledOptions,
      a: cleanAnswerIndex >= 0 ? cleanAnswerIndex : 0,
      subject: subject.trim() || 'Umum'
    };

    let updated: Question[];
    if (editingIndex !== null) {
      updated = [...list];
      updated[editingIndex] = newQuestion;
    } else {
      updated = [...list, newQuestion];
    }

    setList(updated);
    onSaveQuestions(updated);
    resetForm();
    setInfoMsg(`Berhasil menyimpan soal (${updated.length} total soal di bank).`);
    setTimeout(() => setInfoMsg(''), 3000);
  };

  const handleDelete = (idx: number) => {
    if (list.length <= 1) {
      setErrorMsg('Sisakan minimal 1 soal dalam bank soal.');
      return;
    }
    const updated = list.filter((_, i) => i !== idx);
    setList(updated);
    onSaveQuestions(updated);
    if (editingIndex === idx) resetForm();
  };

  const handleResetDefault = () => {
    if (window.confirm('Kembalikan bank soal ke daftar bawaan (12 soal campuran)?')) {
      setList(DEFAULT_QUESTIONS);
      onSaveQuestions(DEFAULT_QUESTIONS);
      resetForm();
      setInfoMsg('Bank soal telah direset ke soal bawaan.');
    }
  };

  const handleLoadPresetPack = (packId: string) => {
    const pack = PRESET_QUESTION_PACKS.find(p => p.id === packId);
    if (!pack) return;

    if (window.confirm(`Gantikan bank soal saat ini dengan paket soal "${pack.title}" (${pack.questions.length} soal)?`)) {
      setList(pack.questions);
      onSaveQuestions(pack.questions);
      resetForm();
      setInfoMsg(`Berhasil memuat paket "${pack.title}" dengan ${pack.questions.length} soal!`);
      setActiveTab('list');
    }
  };

  const handleCombineAllPacks = () => {
    const allQuestions = PRESET_QUESTION_PACKS.flatMap(p => p.questions);
    if (window.confirm(`Muat semua paket mata pelajaran sekaligus (${allQuestions.length} soal lengkap)?`)) {
      setList(allQuestions);
      onSaveQuestions(allQuestions);
      resetForm();
      setInfoMsg(`Berhasil memuat gabungan seluruh paket pelajaran (${allQuestions.length} soal)!`);
      setActiveTab('list');
    }
  };

  const handleExportJson = () => {
    setJsonText(JSON.stringify(list, null, 2));
    setInfoMsg('JSON soal ditampilkan di bawah. Anda dapat menyalinnya.');
  };

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('Format JSON harus berupa array berisi soal.');
      }
      for (const item of parsed) {
        if (!item.q || !Array.isArray(item.o) || item.o.length < 2 || typeof item.a !== 'number') {
          throw new Error('Setiap soal wajib memiliki format { q: string, o: string[], a: number }.');
        }
      }
      const updated = importMode === 'replace' ? parsed : [...list, ...parsed];
      setList(updated);
      onSaveQuestions(updated);
      setInfoMsg(`Berhasil memuat ${parsed.length} soal dari JSON! Total bank: ${updated.length} soal.`);
      setActiveTab('list');
    } catch (e: any) {
      setErrorMsg(e.message || 'Gagal memproses JSON.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setInfoMsg('Membaca dan memvalidasi file…');
    setErrorMsg('');

    try {
      const imported = await parseQuestionsFromFile(file);
      const updated = importMode === 'replace' ? imported : [...list, ...imported];
      setList(updated);
      onSaveQuestions(updated);
      setInfoMsg(`Sukses! ${imported.length} soal berhasil diimpor dari ${file.name}. Total sekarang: ${updated.length} soal.`);
      setActiveTab('list');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal membaca berkas.');
      setInfoMsg('');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 text-[#f3efdc]">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#335a49] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#f5d547] flex items-center gap-2">
              <BookOpen className="w-7 h-7" />
              Bank Soal &amp; Template Kelas
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#14261f] text-[#6fd08c] border border-[#335a49]">
              {list.length} Soal
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#a9bdb2] mt-1">
            Unduh template (Excel/CSV/JSON), impor soal kustom, atau gunakan paket kurikulum siap pakai.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => {
              const newPin = prompt('Atur Kata Sandi / PIN Baru Guru (minimal 4 karakter):');
              if (newPin && newPin.trim().length >= 4) {
                localStorage.setItem('dk_admin_pin', newPin.trim());
                alert('Kata sandi admin berhasil diubah!');
              } else if (newPin !== null) {
                alert('PIN terlalu pendek! Minimal 4 karakter.');
              }
            }}
            className="px-3 py-2 rounded-xl bg-[#14261f] border border-[#335a49] hover:bg-[#25493b] text-xs font-semibold text-[#f5d547] transition-colors"
            title="Ubah kata sandi admin/guru"
          >
            Ubah PIN Guru
          </button>

          <button
            onClick={() => {
              sessionStorage.removeItem('dk_admin_auth');
              onBack();
            }}
            className="px-4 py-2 rounded-xl bg-[#1d3a2f] border border-[#335a49] hover:bg-[#25493b] text-sm font-semibold transition-colors flex items-center gap-1.5 text-[#ef6b5b]"
            title="Keluar dan Kunci Bank Soal"
          >
            <ArrowLeft className="w-4 h-4" />
            Kunci &amp; Keluar
          </button>
        </div>
      </div>

      {/* Info Card: Penjelasan Randomize Soal per Siswa */}
      <div className="bg-[#1d3a2f]/80 border-2 border-[#335a49] rounded-2xl p-4 flex items-start gap-3">
        <Shuffle className="w-5 h-5 text-[#f5d547] shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm text-[#a9bdb2] leading-relaxed">
          <strong className="text-[#f5d547]">Sistem Randomize Soal Otomatis:</strong> Sediakan $X$ soal di bank soal (saat ini <strong>{list.length} soal</strong>). Saat pertandingan dimulai, sistem akan secara otomatis mengundi subset $N$ soal unik untuk masing-masing siswa dan mengacak posisi pilihan jawaban (A, B, C, D) sehingga siswa tidak bisa saling menyontek layar.
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#335a49] pb-2">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-display font-bold transition-all flex items-center gap-2 ${
            activeTab === 'list'
              ? 'bg-[#f5d547] text-[#14261f] shadow'
              : 'text-[#a9bdb2] hover:text-[#f3efdc] hover:bg-[#1d3a2f]'
          }`}
        >
          <Edit3 className="w-4 h-4" />
          Kelola Soal ({list.length})
        </button>

        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-display font-bold transition-all flex items-center gap-2 ${
            activeTab === 'templates'
              ? 'bg-[#f5d547] text-[#14261f] shadow'
              : 'text-[#a9bdb2] hover:text-[#f3efdc] hover:bg-[#1d3a2f]'
          }`}
        >
          <Sparkles className="w-4 h-4 text-[#f5d547]" />
          Paket Pelajaran Siap Pakai
        </button>

        <button
          onClick={() => setActiveTab('import_export')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-display font-bold transition-all flex items-center gap-2 ${
            activeTab === 'import_export'
              ? 'bg-[#f5d547] text-[#14261f] shadow'
              : 'text-[#a9bdb2] hover:text-[#f3efdc] hover:bg-[#1d3a2f]'
          }`}
        >
          <Download className="w-4 h-4" />
          Unduh Template &amp; Impor
        </button>
      </div>

      {/* Feedback Messages */}
      {infoMsg && (
        <div className="p-3 bg-[#6fd08c]/15 border border-[#6fd08c]/40 rounded-xl text-xs sm:text-sm text-[#6fd08c] flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{infoMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-[#ef6b5b]/15 border border-[#ef6b5b]/40 rounded-xl text-xs sm:text-sm text-[#ef6b5b] flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* TAB 1: KELOLA SOAL (Form + List) */}
      {activeTab === 'list' && (
        <div className="space-y-6">
          
          {/* Form Tambah / Edit Soal */}
          <div className="bg-[#1d3a2f] border-2 border-[#335a49] rounded-2xl p-5 space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-[#f5d547] flex items-center gap-2">
                <Edit3 className="w-4 h-4" />
                {editingIndex !== null ? `Edit Soal #${editingIndex + 1}` : 'Tambah Soal Baru Secara Manual'}
              </h3>
              {editingIndex !== null && (
                <button
                  onClick={resetForm}
                  className="text-xs text-[#a9bdb2] hover:text-[#f3efdc] underline"
                >
                  Batal Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-[#a9bdb2] mb-1">
                  Pertanyaan *
                </label>
                <textarea
                  rows={2}
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="Ketik pertanyaan kuis di sini..."
                  className="w-full bg-[#14261f] border border-[#335a49] rounded-xl p-3 text-sm focus:outline-none focus:border-[#f5d547] text-[#f3efdc]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a9bdb2] mb-1">
                  Mata Pelajaran
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Contoh: IPA, Matematika"
                  className="w-full bg-[#14261f] border border-[#335a49] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#f5d547] text-[#f3efdc]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#a9bdb2] mb-1.5 flex items-center justify-between">
                <span>Pilihan Jawaban (Klik bulatan radio untuk menandai kunci jawaban yang benar) *</span>
                <span className="text-[11px] text-[#f5d547]">Kunci aktif: Pilihan {String.fromCharCode(65 + correctIndex)}</span>
              </label>

              <div className="space-y-2.5">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <label 
                      htmlFor={`radio-${i}`}
                      className={`flex items-center justify-center w-8 h-8 rounded-lg cursor-pointer border text-xs font-bold transition-all ${
                        correctIndex === i 
                          ? 'bg-[#6fd08c] text-[#14261f] border-[#6fd08c]' 
                          : 'bg-[#14261f] text-[#a9bdb2] border-[#335a49] hover:border-[#f5d547]'
                      }`}
                    >
                      {String.fromCharCode(65 + i)}
                    </label>
                    <input
                      type="radio"
                      name="correctRadio"
                      id={`radio-${i}`}
                      checked={correctIndex === i}
                      onChange={() => setCorrectIndex(i)}
                      className="hidden"
                    />
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const next = [...options];
                        next[i] = e.target.value;
                        setOptions(next);
                      }}
                      placeholder={`Ketik pilihan ${String.fromCharCode(65 + i)} ${i > 1 ? '(opsional)' : ''}`}
                      className={`flex-1 bg-[#14261f] border rounded-xl px-3.5 py-2 text-sm focus:outline-none text-[#f3efdc] ${
                        correctIndex === i ? 'border-[#6fd08c] ring-1 ring-[#6fd08c]/40' : 'border-[#335a49] focus:border-[#f5d547]'
                      }`}
                    />
                    {correctIndex === i && (
                      <span className="text-xs text-[#6fd08c] font-bold px-2 hidden sm:inline">
                        Kunci Benar
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleSaveQuestion}
                className="px-6 py-2.5 rounded-xl bg-[#f5d547] text-[#14261f] font-display font-bold text-sm hover:bg-[#fad85e] transition-colors flex items-center gap-1.5 shadow"
              >
                <Plus className="w-4 h-4" />
                {editingIndex !== null ? 'Perbarui Soal' : 'Simpan ke Bank Soal'}
              </button>
            </div>
          </div>

          {/* Daftar Soal dalam Bank */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-[#f3efdc] flex items-center gap-2">
                <span>Daftar Soal Aktif</span>
                <span className="text-xs text-[#a9bdb2]">({list.length} soal)</span>
              </h3>
              <button
                onClick={handleResetDefault}
                className="text-xs text-[#ef6b5b] hover:underline flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset ke 12 Soal Bawaan
              </button>
            </div>

            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {list.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-[#1d3a2f] border border-[#335a49] rounded-xl flex items-start justify-between gap-3 text-xs sm:text-sm hover:border-[#3d6e59] transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono font-bold text-[#f5d547]">#{idx + 1}</span>
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-[#14261f] text-[#a9bdb2] border border-[#335a49]">
                        {item.subject || 'Umum'}
                      </span>
                    </div>
                    <div className="font-medium text-[#f3efdc] break-words">
                      {item.q}
                    </div>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-[#a9bdb2]">
                      {item.o.map((opt, oi) => (
                        <div
                          key={oi}
                          className={`p-1.5 rounded-lg flex items-center gap-1.5 ${
                            oi === item.a 
                              ? 'bg-[#6fd08c]/15 text-[#6fd08c] font-semibold border border-[#6fd08c]/30' 
                              : 'bg-[#14261f]/60 text-[#a9bdb2]'
                          }`}
                        >
                          <span className="font-bold">{String.fromCharCode(65 + oi)}.</span>
                          <span className="truncate">{opt}</span>
                          {oi === item.a && <span className="ml-auto text-[10px]">✓ Benar</span>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      onClick={() => handleStartEdit(idx)}
                      className="p-2 rounded-lg bg-[#14261f] text-[#a9bdb2] hover:text-[#f3efdc] hover:bg-[#25493b] transition-colors"
                      title="Edit soal"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(idx)}
                      className="p-2 rounded-lg bg-[#14261f] text-[#ef6b5b] hover:bg-[#ef6b5b]/20 transition-colors"
                      title="Hapus soal"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: PAKET PELAJARAN SIAP PAKAI */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          <div className="bg-[#1d3a2f] border border-[#335a49] rounded-2xl p-5 space-y-2">
            <h3 className="font-display font-bold text-lg text-[#f5d547] flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Paket Kurikulum &amp; Mata Pelajaran 1-Klik
            </h3>
            <p className="text-xs sm:text-sm text-[#a9bdb2]">
              Pilih paket mata pelajaran siap pakai yang telah disusun dengan soal-soal berkualitas. Anda dapat langsung menggunakannya atau menambahkan ke bank soal yang ada.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PRESET_QUESTION_PACKS.map(pack => (
              <div 
                key={pack.id}
                className="bg-[#1d3a2f] border-2 border-[#335a49] hover:border-[#f5d547] rounded-2xl p-5 space-y-3 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{pack.icon}</span>
                    <span className="text-xs font-bold text-[#6fd08c] bg-[#14261f] px-2.5 py-0.5 rounded-full border border-[#335a49]">
                      {pack.questions.length} Soal
                    </span>
                  </div>
                  <h4 className="font-display font-bold text-base text-[#f5d547] mt-2">
                    {pack.title}
                  </h4>
                  <p className="text-xs text-[#a9bdb2] mt-1">
                    {pack.description}
                  </p>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    onClick={() => handleLoadPresetPack(pack.id)}
                    className="flex-1 py-2 rounded-xl bg-[#f5d547] text-[#14261f] font-display font-bold text-xs hover:bg-[#fad85e] transition-colors shadow"
                  >
                    Gunakan Paket Ini
                  </button>
                  <button
                    onClick={() => downloadExcelTemplate(pack.questions)}
                    className="px-3 py-2 rounded-xl bg-[#14261f] border border-[#335a49] hover:bg-[#25493b] text-xs font-semibold text-[#f3efdc] transition-colors"
                    title="Unduh sebagai file Excel"
                  >
                    .xlsx
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Tombol Gabungkan Seluruh Paket */}
          <div className="p-5 bg-[#1d3a2f] border-2 border-[#f5d547]/40 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="font-display font-bold text-base text-[#f5d547] flex items-center gap-2">
                <Layers className="w-5 h-5" />
                Gabungkan Seluruh Mata Pelajaran (75 Soal Total)
              </h4>
              <p className="text-xs text-[#a9bdb2] mt-0.5">
                Kombinasikan IPA, Matematika, IPS, Bahasa Indonesia, dan Logika Umum ke dalam 1 bank soal raksasa.
              </p>
            </div>
            <button
              onClick={handleCombineAllPacks}
              className="px-5 py-2.5 rounded-xl bg-[#f5d547] text-[#14261f] font-display font-bold text-sm hover:bg-[#fad85e] transition-colors shrink-0 shadow"
            >
              Muat Semua Paket (75 Soal)
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: UNDUH TEMPLATE & IMPOR */}
      {activeTab === 'import_export' && (
        <div className="space-y-6">
          
          {/* Section 1: Unduh File Template */}
          <div className="bg-[#1d3a2f] border-2 border-[#335a49] rounded-2xl p-5 space-y-4">
            <div>
              <h3 className="font-display font-bold text-base sm:text-lg text-[#f5d547] flex items-center gap-2">
                <Download className="w-5 h-5" />
                1. Unduh Template Soal (Download Template)
              </h3>
              <p className="text-xs sm:text-sm text-[#a9bdb2] mt-1">
                Unduh file template kosong berformat rapi di bawah ini, lalu isi dengan soal buatan guru / sekolah Anda:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <button
                onClick={() => downloadExcelTemplate(list)}
                className="p-4 bg-[#14261f] border-2 border-[#335a49] hover:border-[#6fd08c] rounded-xl flex flex-col items-center justify-center text-center gap-2 transition-all group cursor-pointer"
              >
                <FileSpreadsheet className="w-8 h-8 text-[#6fd08c] group-hover:scale-110 transition-transform" />
                <div className="font-display font-bold text-sm text-[#f3efdc]">
                  Template Excel (.xlsx)
                </div>
                <span className="text-[11px] text-[#a9bdb2]">
                  Standar Microsoft Excel (Disarankan)
                </span>
              </button>

              <button
                onClick={() => downloadCsvTemplate(list)}
                className="p-4 bg-[#14261f] border-2 border-[#335a49] hover:border-[#f5d547] rounded-xl flex flex-col items-center justify-center text-center gap-2 transition-all group cursor-pointer"
              >
                <FileText className="w-8 h-8 text-[#f5d547] group-hover:scale-110 transition-transform" />
                <div className="font-display font-bold text-sm text-[#f3efdc]">
                  Template CSV (.csv)
                </div>
                <span className="text-[11px] text-[#a9bdb2]">
                  Dukungan Google Spreadsheet &amp; Notepad
                </span>
              </button>

              <button
                onClick={() => downloadJsonTemplate(list)}
                className="p-4 bg-[#14261f] border-2 border-[#335a49] hover:border-[#7fdcff] rounded-xl flex flex-col items-center justify-center text-center gap-2 transition-all group cursor-pointer"
              >
                <FileText className="w-8 h-8 text-[#7fdcff] group-hover:scale-110 transition-transform" />
                <div className="font-display font-bold text-sm text-[#f3efdc]">
                  Template JSON (.json)
                </div>
                <span className="text-[11px] text-[#a9bdb2]">
                  Struktur data teknis untuk developer
                </span>
              </button>
            </div>

            {/* Format Kolom Panduan */}
            <div className="p-3 bg-[#14261f] border border-[#335a49] rounded-xl text-xs text-[#a9bdb2] space-y-1">
              <div className="font-bold text-[#f5d547]">Format Kolom Excel / CSV:</div>
              <div>• <strong>Kolom A</strong>: Nomor Soal (1, 2, 3...)</div>
              <div>• <strong>Kolom B</strong>: Pertanyaan Soal</div>
              <div>• <strong>Kolom C s/d F</strong>: Pilihan A, Pilihan B, Pilihan C, Pilihan D</div>
              <div>• <strong>Kolom G</strong>: Kunci Jawaban (Isi dengan <strong>A</strong>, <strong>B</strong>, <strong>C</strong>, atau <strong>D</strong>)</div>
              <div>• <strong>Kolom H</strong>: Mata Pelajaran (Contoh: IPA, Matematika, Umum)</div>
            </div>
          </div>

          {/* Section 2: Impor File */}
          <div className="bg-[#1d3a2f] border-2 border-[#335a49] rounded-2xl p-5 space-y-4">
            <div>
              <h3 className="font-display font-bold text-base sm:text-lg text-[#f5d547] flex items-center gap-2">
                <Upload className="w-5 h-5" />
                2. Impor Berkas Soal Anda (.xlsx, .csv, .json, .docx)
              </h3>
              <p className="text-xs sm:text-sm text-[#a9bdb2] mt-1">
                Unggah file soal yang telah Anda isi sesuai template di atas:
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              <span className="text-[#a9bdb2] font-semibold">Mode Impor:</span>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'append'}
                  onChange={() => setImportMode('append')}
                  className="accent-[#f5d547]"
                />
                <span>Tambahkan ke bank soal saat ini</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="accent-[#f5d547]"
                />
                <span className="text-[#ef6b5b]">Gantikan semua soal yang ada</span>
              </label>
            </div>

            <div className="pt-2">
              <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-[#335a49] hover:border-[#f5d547] rounded-2xl bg-[#14261f] cursor-pointer transition-all text-center group">
                <Upload className="w-10 h-10 text-[#f5d547] group-hover:scale-110 transition-transform mb-2" />
                <span className="font-display font-bold text-sm text-[#f3efdc]">
                  Klik untuk Memilih File (.xlsx, .csv, .json, .docx)
                </span>
                <span className="text-xs text-[#a9bdb2] mt-1">
                  Mendukung Microsoft Excel, Google Sheets CSV, JSON, atau Microsoft Word
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.json,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Section 3: Cadangan JSON / Teks */}
          <div className="bg-[#1d3a2f] border border-[#335a49] rounded-2xl p-5 space-y-3">
            <h4 className="font-display font-bold text-base text-[#f5d547]">
              Cadangan Cepat (Salin &amp; Tempel JSON)
            </h4>
            <textarea
              rows={3}
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder="Tempel teks JSON soal di sini..."
              className="w-full bg-[#14261f] border border-[#335a49] rounded-xl p-3 text-xs font-mono text-[#a9bdb2] focus:outline-none"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExportJson}
                className="px-3.5 py-2 rounded-xl bg-[#14261f] border border-[#335a49] hover:bg-[#25493b] text-xs font-semibold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Tampilkan JSON Bank Soal
              </button>
              <button
                onClick={handleImportJson}
                disabled={!jsonText.trim()}
                className="px-3.5 py-2 rounded-xl bg-[#f5d547] text-[#14261f] font-semibold text-xs hover:bg-[#fad85e] transition-colors disabled:opacity-50"
              >
                Muat dari Teks JSON
              </button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
