import React, { useState } from 'react';
import { Question } from '../types/game';
import { DEFAULT_QUESTIONS } from '../data/defaultQuestions';
import { ArrowLeft, Plus, Trash2, Edit3, Upload, Download, RotateCcw, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';

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

    // Map the selected radio index to the filtered non-empty options
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
    setInfoMsg(`Berhasil menyimpan soal (${updated.length} total soal).`);
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
    if (window.confirm('Kembalikan bank soal ke daftar bawaan?')) {
      setList(DEFAULT_QUESTIONS);
      onSaveQuestions(DEFAULT_QUESTIONS);
      resetForm();
      setInfoMsg('Bank soal telah direset ke soal bawaan.');
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
      setList(parsed);
      onSaveQuestions(parsed);
      setInfoMsg(`Berhasil memuat ${parsed.length} soal dari JSON.`);
    } catch (e: any) {
      setErrorMsg(e.message || 'Gagal memproses JSON.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setInfoMsg('Membaca file…');
    setErrorMsg('');

    try {
      const buffer = await file.arrayBuffer();
      let imported: Question[] = [];

      if (/\.docx$/i.test(file.name)) {
        const mammoth = (window as any).mammoth;
        if (!mammoth) throw new Error('Pustaka pembaca Word belum siap.');
        const result = await mammoth.extractRawText({ arrayBuffer: buffer });
        const lines = result.value.split(/\r?\n/).map((s: string) => s.trim()).filter(Boolean);
        
        let cur: { q: string; o: string[]; a: number } | null = null;
        for (const line of lines) {
          const ansMatch = line.match(/^(jawaban|kunci)\s*[:=]\s*([A-Da-d1-4])/i);
          const optMatch = line.match(/^([A-Da-d])[.)]\s*(.+)/);
          
          if (ansMatch && cur) {
            const letter = ansMatch[2].toLowerCase();
            cur.a = /\d/.test(letter) ? parseInt(letter) - 1 : 'abcd'.indexOf(letter);
          } else if (optMatch && cur) {
            cur.o.push(optMatch[2]);
          } else {
            if (cur && cur.o.length >= 2 && cur.a >= 0) {
              imported.push({ ...cur, subject: 'Word Import' });
            }
            cur = { q: line.replace(/^\d+[.)]\s*/, ''), o: [], a: -1 };
          }
        }
        if (cur && cur.o.length >= 2 && cur.a >= 0) {
          imported.push({ ...cur, subject: 'Word Import' });
        }
      } else {
        // Excel / CSV
        const XLSX = (window as any).XLSX;
        if (!XLSX) throw new Error('Pustaka pembaca Excel belum siap.');
        const wb = XLSX.read(buffer, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        for (const row of rows) {
          const cols = row.map(c => String(c ?? '').trim());
          if (!cols[0] || /^(pertanyaan|soal)$/i.test(cols[0])) continue;
          
          const questionText = cols[0];
          const rawOpts = cols.slice(1, 5).filter(Boolean);
          const key = cols[5] || '';
          let ansIdx = -1;

          if (/^[A-Da-d]$/.test(key)) {
            ansIdx = 'abcd'.indexOf(key.toLowerCase());
          } else if (/^[1-4]$/.test(key)) {
            ansIdx = parseInt(key) - 1;
          } else {
            ansIdx = rawOpts.findIndex(o => o.toLowerCase() === key.toLowerCase());
          }

          if (rawOpts.length >= 2 && ansIdx >= 0 && ansIdx < rawOpts.length) {
            imported.push({
              q: questionText,
              o: rawOpts,
              a: ansIdx,
              subject: 'Excel Import'
            });
          }
        }
      }

      if (imported.length === 0) {
        throw new Error('Tidak ada soal yang berhasil diparsing. Periksa kesesuaian format file.');
      }

      const combined = [...list, ...imported];
      setList(combined);
      onSaveQuestions(combined);
      setInfoMsg(`Berhasil menambahkan ${imported.length} soal baru dari file.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal membaca file.');
      setInfoMsg('');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 text-[#f3efdc]">
      
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4 border-b border-[#335a49] pb-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#f5d547]">
            Bank Soal &amp; Tugas Kelas
          </h2>
          <p className="text-xs sm:text-sm text-[#a9bdb2]">
            Total {list.length} soal aktif untuk stasiun tantangan permainan
          </p>
        </div>

        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-[#1d3a2f] border border-[#335a49] hover:bg-[#25493b] text-sm font-medium transition-colors flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Menu
        </button>
      </div>

      {infoMsg && (
        <div className="p-3 bg-[#6fd08c]/15 border border-[#6fd08c]/40 rounded-xl text-xs sm:text-sm text-[#6fd08c] flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{infoMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-[#ef6b5b]/15 border border-[#ef6b5b]/40 rounded-xl text-xs sm:text-sm text-[#ef6b5b] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Form Tambah / Edit Soal */}
      <div className="bg-[#1d3a2f] border-2 border-[#335a49] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-lg text-[#f5d547] flex items-center gap-2">
            <Edit3 className="w-4 h-4" />
            {editingIndex !== null ? `Edit Soal #${editingIndex + 1}` : 'Tambah Soal Baru'}
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

        <div>
          <label className="block text-xs font-medium text-[#a9bdb2] mb-1">
            Pertanyaan
          </label>
          <textarea
            rows={2}
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="Tuliskan pertanyaan di sini..."
            className="w-full bg-[#14261f] border border-[#335a49] rounded-xl p-3 text-sm focus:outline-none focus:border-[#f5d547] text-[#f3efdc]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#a9bdb2] mb-1.5">
            Pilihan Jawaban (Pilih bulatan untuk menentukan kunci jawaban yang benar)
          </label>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correctRadio"
                  checked={correctIndex === i}
                  onChange={() => setCorrectIndex(i)}
                  className="w-4 h-4 accent-[#f5d547] cursor-pointer"
                  id={`radio-${i}`}
                />
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => {
                    const next = [...options];
                    next[i] = e.target.value;
                    setOptions(next);
                  }}
                  placeholder={`Pilihan ${String.fromCharCode(65 + i)} ${i > 1 ? '(opsional)' : ''}`}
                  className="flex-1 bg-[#14261f] border border-[#335a49] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#f5d547] text-[#f3efdc]"
                />
                {correctIndex === i && opt.trim() && (
                  <span className="text-[11px] text-[#6fd08c] font-semibold px-2">
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
            className="px-5 py-2.5 rounded-xl bg-[#f5d547] text-[#14261f] font-bold text-sm hover:bg-[#fad85e] transition-colors flex items-center gap-1.5 shadow"
          >
            <Plus className="w-4 h-4" />
            {editingIndex !== null ? 'Perbarui Soal' : 'Simpan ke Bank Soal'}
          </button>
        </div>
      </div>

      {/* Impor dari Dokumen Word / Excel */}
      <div className="bg-[#1d3a2f] border border-[#335a49] rounded-2xl p-5 space-y-3">
        <h3 className="font-display font-bold text-base text-[#f5d547] flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4" />
          Impor dari Dokumen Word (.docx) atau Excel (.xlsx, .csv)
        </h3>
        <p className="text-xs text-[#a9bdb2] leading-relaxed">
          • <strong>Excel/CSV</strong>: Kolom 1 = Pertanyaan, Kolom 2-5 = Pilihan A, B, C, D, Kolom 6 = Kunci (A/B/C/D).<br />
          • <strong>Word (.docx)</strong>: Tulis nomor dan soal, lalu baris &ldquo;A. ...&rdquo; sampai &ldquo;D. ...&rdquo;, dan &ldquo;Jawaban: A&rdquo;.
        </p>

        <div className="pt-2">
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#14261f] border border-[#335a49] hover:bg-[#1a3229] cursor-pointer text-xs font-semibold text-[#f5d547] transition-colors">
            <Upload className="w-3.5 h-3.5" />
            Pilih Berkas (.docx, .xlsx, .csv)
            <input
              type="file"
              accept=".docx,.xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Daftar Soal yang Ada */}
      <div className="space-y-3">
        <h3 className="font-display font-bold text-base text-[#f3efdc]">
          Daftar Soal ({list.length})
        </h3>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {list.map((item, idx) => (
            <div
              key={idx}
              className="p-3 bg-[#1d3a2f] border border-[#335a49] rounded-xl flex items-start justify-between gap-3 text-xs sm:text-sm"
            >
              <div className="flex-1">
                <span className="font-bold text-[#f5d547] mr-1.5">{idx + 1}.</span>
                <span className="font-medium text-[#f3efdc]">{item.q}</span>
                <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-[#a9bdb2]">
                  {item.o.map((opt, oi) => (
                    <span
                      key={oi}
                      className={oi === item.a ? 'text-[#6fd08c] font-bold' : ''}
                    >
                      {String.fromCharCode(65 + oi)}. {opt} {oi === item.a ? '✓' : ''}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleStartEdit(idx)}
                  className="p-1.5 rounded-lg bg-[#14261f] text-[#a9bdb2] hover:text-[#f3efdc] transition-colors"
                  title="Edit soal"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(idx)}
                  className="p-1.5 rounded-lg bg-[#14261f] text-[#ef6b5b] hover:bg-[#ef6b5b]/20 transition-colors"
                  title="Hapus soal"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ekspor & Impor JSON */}
      <div className="bg-[#1d3a2f] border border-[#335a49] rounded-2xl p-5 space-y-3">
        <h3 className="font-display font-bold text-base text-[#f5d547]">
          Cadangan &amp; Berbagi Soal (JSON)
        </h3>
        
        <textarea
          rows={3}
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder="Tempel format JSON di sini untuk mengimpor atau klik 'Tampilkan JSON' untuk menyalin..."
          className="w-full bg-[#14261f] border border-[#335a49] rounded-xl p-3 text-xs font-mono text-[#a9bdb2] focus:outline-none"
        />

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={handleExportJson}
            className="px-3 py-1.5 rounded-lg bg-[#14261f] border border-[#335a49] hover:bg-[#25493b] text-xs font-medium flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Tampilkan JSON
          </button>
          <button
            onClick={handleImportJson}
            className="px-3 py-1.5 rounded-lg bg-[#14261f] border border-[#335a49] hover:bg-[#25493b] text-xs font-medium flex items-center gap-1.5 text-[#f5d547]"
          >
            <Upload className="w-3.5 h-3.5" />
            Muat dari JSON
          </button>
          <button
            onClick={handleResetDefault}
            className="px-3 py-1.5 rounded-lg bg-[#ef6b5b]/15 border border-[#ef6b5b]/30 hover:bg-[#ef6b5b]/25 text-xs font-medium flex items-center gap-1.5 text-[#ef6b5b] ml-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset ke Bawaan
          </button>
        </div>
      </div>

    </div>
  );
};
