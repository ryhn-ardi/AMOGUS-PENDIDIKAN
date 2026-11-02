import { Question } from '../types/game';

// Template sample rows
export const SAMPLE_TEMPLATE_QUESTIONS: Question[] = [
  {
    q: 'Berapakah hasil dari operasi 15 × 8?',
    o: ['110', '120', '130', '140'],
    a: 1, // B (120)
    subject: 'Matematika'
  },
  {
    q: 'Proses fotosintesis pada tumbuhan hijau menghasilkan gas…',
    o: ['Nitrogen', 'Karbon Monoksida', 'Oksigen', 'Hidrogen'],
    a: 2, // C (Oksigen)
    subject: 'IPA'
  },
  {
    q: 'Teks Proklamasi Kemerdekaan Indonesia diketik oleh tokoh bernama…',
    o: ['Sayuti Melik', 'Sukarni', 'BM Diah', 'Moh. Hatta'],
    a: 0, // A (Sayuti Melik)
    subject: 'Sejarah'
  },
  {
    q: 'Sinonim dari kata "akurat" dalam bahasa Indonesia adalah…',
    o: ['Cepat', 'Tepat', 'Ringkas', 'Indah'],
    a: 1, // B (Tepat)
    subject: 'Bahasa Indonesia'
  },
  {
    q: 'Planet terdekat dari Matahari dalam sistem tata surya kita adalah…',
    o: ['Venus', 'Bumi', 'Merkurius', 'Mars'],
    a: 2, // C (Merkurius)
    subject: 'IPA'
  }
];

/**
 * Unduh template soal dalam format Excel (.xlsx)
 */
export function downloadExcelTemplate(sampleQuestions: Question[] = SAMPLE_TEMPLATE_QUESTIONS) {
  const XLSX = (window as any).XLSX;
  const headers = ['No', 'Pertanyaan', 'Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D', 'Kunci Jawaban', 'Mata Pelajaran'];
  
  const rows = sampleQuestions.map((q, idx) => {
    const letters = ['A', 'B', 'C', 'D'];
    const keyLetter = letters[q.a] || 'A';
    return [
      idx + 1,
      q.q,
      q.o[0] || '',
      q.o[1] || '',
      q.o[2] || '',
      q.o[3] || '',
      keyLetter,
      q.subject || 'Umum'
    ];
  });

  const data = [headers, ...rows];

  if (XLSX) {
    try {
      const ws = XLSX.utils.aoa_to_sheet(data);
      // Auto column widths
      ws['!cols'] = [
        { wch: 6 },
        { wch: 45 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 15 },
        { wch: 18 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template Soal');
      XLSX.writeFile(wb, 'Template_Soal_Detektif_Kelas.xlsx');
      return true;
    } catch (e) {
      console.warn('XLSX writing error, falling back to CSV download', e);
    }
  }

  // Fallback to CSV if XLSX library is unavailable
  downloadCsvTemplate(sampleQuestions);
  return true;
}

/**
 * Unduh template soal dalam format CSV (.csv)
 */
export function downloadCsvTemplate(sampleQuestions: Question[] = SAMPLE_TEMPLATE_QUESTIONS) {
  const headers = ['No', 'Pertanyaan', 'Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D', 'Kunci Jawaban', 'Mata Pelajaran'];
  const letters = ['A', 'B', 'C', 'D'];

  const rows = sampleQuestions.map((q, idx) => {
    const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`;
    return [
      idx + 1,
      escapeCsv(q.q),
      escapeCsv(q.o[0] || ''),
      escapeCsv(q.o[1] || ''),
      escapeCsv(q.o[2] || ''),
      escapeCsv(q.o[3] || ''),
      escapeCsv(letters[q.a] || 'A'),
      escapeCsv(q.subject || 'Umum')
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Template_Soal_Detektif_Kelas.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Unduh template soal dalam format JSON (.json)
 */
export function downloadJsonTemplate(sampleQuestions: Question[] = SAMPLE_TEMPLATE_QUESTIONS) {
  const jsonString = JSON.stringify(sampleQuestions, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Template_Soal_Detektif_Kelas.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Parser file universal: .xlsx, .xls, .csv, .json, .docx
 */
export async function parseQuestionsFromFile(file: File): Promise<Question[]> {
  const fileName = file.name.toLowerCase();

  // 1. JSON
  if (fileName.endsWith('.json')) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('File JSON harus berisi array daftar soal.');
    }
    return parsed.map((item, idx) => {
      if (!item.q || !Array.isArray(item.o) || item.o.length < 2) {
        throw new Error(`Soal baris #${idx + 1} tidak memiliki pertanyaan atau opsi yang lengkap.`);
      }
      return {
        q: String(item.q).trim(),
        o: item.o.map((o: any) => String(o).trim()).filter(Boolean),
        a: typeof item.a === 'number' && item.a >= 0 && item.a < item.o.length ? item.a : 0,
        subject: item.subject ? String(item.subject).trim() : 'Impor JSON'
      };
    });
  }

  // 2. Word (.docx)
  if (fileName.endsWith('.docx')) {
    const mammoth = (window as any).mammoth;
    if (!mammoth) throw new Error('Pustaka pembaca Word belum dimuat.');
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    const lines = result.value.split(/\r?\n/).map((s: string) => s.trim()).filter(Boolean);

    const questions: Question[] = [];
    let cur: { q: string; o: string[]; a: number; subject?: string } | null = null;

    for (const line of lines) {
      const ansMatch = line.match(/^(jawaban|kunci)\s*[:=]\s*([A-Da-d1-4])/i);
      const optMatch = line.match(/^([A-Da-d])[.)]\s*(.+)/);

      if (ansMatch && cur) {
        const letter = ansMatch[2].toLowerCase();
        cur.a = /\d/.test(letter) ? parseInt(letter) - 1 : 'abcd'.indexOf(letter);
      } else if (optMatch && cur) {
        cur.o.push(optMatch[2].trim());
      } else {
        if (cur && cur.o.length >= 2 && cur.a >= 0) {
          questions.push({ ...cur, subject: cur.subject || 'Impor Word' });
        }
        cur = {
          q: line.replace(/^\d+[.)]\s*/, '').trim(),
          o: [],
          a: -1,
          subject: 'Impor Word'
        };
      }
    }
    if (cur && cur.o.length >= 2 && cur.a >= 0) {
      questions.push({ ...cur, subject: cur.subject || 'Impor Word' });
    }

    if (questions.length === 0) {
      throw new Error('Tidak ada soal yang terdeteksi dari dokumen Word. Pastikan format: 1. Soal, A. Pilihan, B. Pilihan, Kunci: A');
    }
    return questions;
  }

  // 3. Excel (.xlsx, .xls) atau CSV (.csv)
  const XLSX = (window as any).XLSX;
  if (!XLSX) {
    throw new Error('Pustaka pembaca tabel Excel/CSV belum siap.');
  }

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('File tabel kosong.');
  }

  const questions: Question[] = [];

  for (let r = 0; r < rawRows.length; r++) {
    const row = rawRows[r].map(c => String(c ?? '').trim());
    if (row.length === 0 || !row[0] && !row[1]) continue;

    // Skip Header Row
    const firstCell = (row[0] || '').toLowerCase();
    const secondCell = (row[1] || '').toLowerCase();
    if (
      firstCell === 'no' || 
      firstCell.includes('pertanyaan') || 
      firstCell.includes('soal') ||
      secondCell.includes('pertanyaan') || 
      secondCell.includes('soal')
    ) {
      continue;
    }

    // Determine if Column 0 is "No" (e.g. 1, 2, 3) or the actual question text
    let qText = '';
    let optStart = 1;
    let keyIdx = 5;
    let subjectIdx = 6;

    if (/^\d+$/.test(row[0]) && row[1]) {
      // Column 0 is row number, Column 1 is Question
      qText = row[1];
      optStart = 2;
      keyIdx = 6;
      subjectIdx = 7;
    } else {
      // Column 0 is Question
      qText = row[0];
      optStart = 1;
      keyIdx = 5;
      subjectIdx = 6;
    }

    if (!qText) continue;

    const rawOpts = row.slice(optStart, optStart + 4).map(o => String(o).trim()).filter(Boolean);
    const keyVal = String(row[keyIdx] ?? '').trim().toLowerCase();
    const subject = String(row[subjectIdx] ?? '').trim() || 'Impor Tabel';

    let ansIndex = -1;
    if (/^[a-d]$/.test(keyVal)) {
      ansIndex = 'abcd'.indexOf(keyVal);
    } else if (/^[1-4]$/.test(keyVal)) {
      ansIndex = parseInt(keyVal) - 1;
    } else if (keyVal) {
      ansIndex = rawOpts.findIndex(o => o.toLowerCase() === keyVal);
    }

    if (rawOpts.length >= 2 && ansIndex >= 0 && ansIndex < rawOpts.length) {
      questions.push({
        q: qText,
        o: rawOpts,
        a: ansIndex,
        subject
      });
    }
  }

  if (questions.length === 0) {
    throw new Error('Tidak ada soal yang berhasil diparsing. Pastikan format tabel memiliki kolom: Pertanyaan, Pilihan A, B, C, D, dan Kunci Jawaban (A/B/C/D).');
  }

  return questions;
}
