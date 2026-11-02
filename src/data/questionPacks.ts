import { Question } from '../types/game';

export interface QuestionPack {
  id: string;
  title: string;
  icon: string;
  subject: string;
  description: string;
  questions: Question[];
}

export const PRESET_QUESTION_PACKS: QuestionPack[] = [
  {
    id: 'ipa_sains',
    title: 'Ilmu Pengetahuan Alam (IPA)',
    icon: '🧪',
    subject: 'IPA & Sains',
    description: 'Biologi, Fisika dasar, Tata Surya, dan Ekosistem Lingkungan.',
    questions: [
      {
        q: 'Proses tumbuhan hijau mengolah makanan menggunakan bantuan sinar matahari disebut…',
        o: ['Fotosintesis', 'Respirasi', 'Fermentasi', 'Metamorfosis'],
        a: 0,
        subject: 'IPA'
      },
      {
        q: 'Planet dalam tata surya kita yang paling dekat dengan Matahari adalah…',
        o: ['Venus', 'Merkurius', 'Bumi', 'Mars'],
        a: 1,
        subject: 'IPA'
      },
      {
        q: 'Organ pada tubuh manusia yang berfungsi menyaring racun dari darah adalah…',
        o: ['Jantung', 'Hati', 'Paru-paru', 'Lambung'],
        a: 1,
        subject: 'IPA'
      },
      {
        q: 'Satuan internasional (SI) untuk besaran suhu adalah…',
        o: ['Celsius', 'Kelvin', 'Fahrenheit', 'Reamur'],
        a: 1,
        subject: 'IPA'
      },
      {
        q: 'Perubahan wujud zat dari cair menjadi gas dinamakan…',
        o: ['Mencair', 'Menguap', 'Membeku', 'Menyublim'],
        a: 1,
        subject: 'IPA'
      },
      {
        q: 'Bagian sel darah yang berfungsi melawan bibit penyakit dan infeksi adalah…',
        o: ['Sel darah merah', 'Sel darah putih', 'Trombosit', 'Plasma darah'],
        a: 1,
        subject: 'IPA'
      },
      {
        q: 'Hewan yang mengalami metamorfosis sempurna dalam daur hidupnya adalah…',
        o: ['Kecoa', 'Kupu-kupu', 'Belalang', 'Jangkrik'],
        a: 1,
        subject: 'IPA'
      },
      {
        q: 'Planet di tata surya yang memiliki cincin paling tampak dan indah adalah…',
        o: ['Jupiter', 'Saturnus', 'Uranus', 'Neptunus'],
        a: 1,
        subject: 'IPA'
      },
      {
        q: 'Gas yang paling melimpah di lapisan atmosfer bumi adalah…',
        o: ['Oksigen', 'Nitrogen', 'Karbon dioksida', 'Helium'],
        a: 1,
        subject: 'IPA'
      },
      {
        q: 'Gaya tarik yang menyebabkan semua benda tertarik ke pusat bumi dinamakan gaya…',
        o: ['Magnet', 'Gesek', 'Gravitasi', 'Pegas'],
        a: 2,
        subject: 'IPA'
      },
      {
        q: 'Bunyi tidak dapat merambat melalui medium berupa…',
        o: ['Udara', 'Air', 'Benda padat', 'Ruang hampa udara'],
        a: 3,
        subject: 'IPA'
      },
      {
        q: 'Hubungan antara kupu-kupu dan bunga merupakan contoh simbiosis…',
        o: ['Mutualisme', 'Komensalisme', 'Parasitisme', 'Netralisme'],
        a: 0,
        subject: 'IPA'
      },
      {
        q: 'Organ pernapasan utama pada ikan saat berada di dalam air adalah…',
        o: ['Paru-paru', 'Trakea', 'Insang', 'Kulit'],
        a: 2,
        subject: 'IPA'
      },
      {
        q: 'Energi panas yang merambat secara langsung tanpa zat perantara disebut…',
        o: ['Konduksi', 'Konveksi', 'Radiasi', 'Evaporasi'],
        a: 2,
        subject: 'IPA'
      },
      {
        q: 'Lapisan bumi terluar tempat manusia dan makhluk hidup tinggal disebut…',
        o: ['Kerak bumi', 'Mantel bumi', 'Inti luar', 'Inti dalam'],
        a: 0,
        subject: 'IPA'
      }
    ]
  },
  {
    id: 'matematika',
    title: 'Matematika & Logika Berhitung',
    icon: '📐',
    subject: 'Matematika',
    description: 'Aritmatika cepat, aljabar dasar, bangun datar, dan persentase.',
    questions: [
      {
        q: 'Berapakah hasil dari operasi 15 × 8?',
        o: ['110', '120', '130', '140'],
        a: 1,
        subject: 'Matematika'
      },
      {
        q: 'Berapakah nilai dari √169?',
        o: ['11', '12', '13', '14'],
        a: 2,
        subject: 'Matematika'
      },
      {
        q: 'Bentuk persen dari pecahan 3/4 adalah…',
        o: ['65%', '70%', '75%', '80%'],
        a: 2,
        subject: 'Matematika'
      },
      {
        q: 'Keliling persegi dengan panjang sisi 14 cm adalah…',
        o: ['48 cm', '52 cm', '56 cm', '64 cm'],
        a: 2,
        subject: 'Matematika'
      },
      {
        q: 'Berapakah hasil dari (-15) + 28?',
        o: ['-13', '13', '43', '-43'],
        a: 1,
        subject: 'Matematika'
      },
      {
        q: 'Sebuah segitiga memiliki alas 10 cm dan tinggi 8 cm. Berapakah luasnya?',
        o: ['40 cm²', '80 cm²', '36 cm²', '60 cm²'],
        a: 0,
        subject: 'Matematika'
      },
      {
        q: 'Jika 3x + 5 = 20, berapakah nilai x?',
        o: ['3', '4', '5', '6'],
        a: 2,
        subject: 'Matematika'
      },
      {
        q: 'Bilangan prima terkecil yang lebih besar dari angka 20 adalah…',
        o: ['21', '23', '27', '29'],
        a: 1,
        subject: 'Matematika'
      },
      {
        q: 'Berapakah hasil dari 25% dari 240?',
        o: ['50', '60', '70', '80'],
        a: 1,
        subject: 'Matematika'
      },
      {
        q: 'Berapakah FPB dari angka 24 dan 36?',
        o: ['6', '8', '12', '18'],
        a: 2,
        subject: 'Matematika'
      },
      {
        q: 'Sebuah lingkaran memiliki jari-jari 7 cm. Berapakah kelilingnya? (π = 22/7)',
        o: ['22 cm', '44 cm', '88 cm', '154 cm'],
        a: 1,
        subject: 'Matematika'
      },
      {
        q: 'Berapakah nilai dari 2 pangkat 5 (2⁵)?',
        o: ['16', '32', '64', '128'],
        a: 1,
        subject: 'Matematika'
      },
      {
        q: 'Rata-rata dari angka 6, 8, 9, 7, dan 10 adalah…',
        o: ['7.5', '8.0', '8.2', '8.5'],
        a: 1,
        subject: 'Matematika'
      },
      {
        q: 'Sudut yang besarnya tepat 90 derajat disebut sudut…',
        o: ['Lancip', 'Tumpul', 'Siku-siku', 'Lurus'],
        a: 2,
        subject: 'Matematika'
      },
      {
        q: 'Berapakah hasil dari 144 ÷ 12 + 8?',
        o: ['18', '20', '22', '24'],
        a: 1,
        subject: 'Matematika'
      }
    ]
  },
  {
    id: 'ips_sejarah',
    title: 'IPS, Geografi & Sejarah Nasional',
    icon: '🌍',
    subject: 'IPS & Sejarah',
    description: 'Sejarah kemerdekaan, letak geografis Nusantara, dan pahlawan nasional.',
    questions: [
      {
        q: 'Teks Proklamasi Kemerdekaan Indonesia diketik oleh tokoh bernama…',
        o: ['Sayuti Melik', 'Sukarni', 'BM Diah', 'Chaerul Saleh'],
        a: 0,
        subject: 'Sejarah'
      },
      {
        q: 'Peristiwa Rengasdengklok terjadi dengan tujuan mendesak agar…',
        o: ['Belanda menyerah', 'Proklamasi segera dilaksanakan', 'BPUPKI dibubarkan', 'Menyerang markas Jepang'],
        a: 1,
        subject: 'Sejarah'
      },
      {
        q: 'Selat yang memisahkan Pulau Jawa dan Pulau Sumatra dinamakan…',
        o: ['Selat Malaka', 'Selat Sunda', 'Selat Bali', 'Selat Makassar'],
        a: 1,
        subject: 'Geografi'
      },
      {
        q: 'Candi bercorak Buddha terbesar di dunia yang terletak di Magelang adalah…',
        o: ['Prambanan', 'Borobudur', 'Mendut', 'Penataran'],
        a: 1,
        subject: 'Sejarah'
      },
      {
        q: 'Secara astronomis, wilayah Indonesia dilalui oleh garis khayal penting yaitu…',
        o: ['Khatulistiwa', 'Meridian Nol', 'Balik Utara', 'Balik Selatan'],
        a: 0,
        subject: 'Geografi'
      },
      {
        q: 'Semboyan pemersatu bangsa "Bhinneka Tunggal Ika" berasal dari kitab…',
        o: ['Negarakertagama', 'Sutasoma', 'Pararaton', 'Arjunawiwaha'],
        a: 1,
        subject: 'Sejarah'
      },
      {
        q: 'Danau vulkanik terbesar di Asia Tenggara yang terletak di Sumatra Utara adalah…',
        o: ['Danau Singkarak', 'Danau Toba', 'Danau Maninjau', 'Danau Ranau'],
        a: 1,
        subject: 'Geografi'
      },
      {
        q: 'Pahlawan nasional wanita yang berasal dari tanah Jepara adalah…',
        o: ['Cut Nyak Dien', 'R.A. Kartini', 'Dewi Sartika', 'Martha Christina Tiahahu'],
        a: 1,
        subject: 'Sejarah'
      },
      {
        q: 'Mata uang resmi yang digunakan oleh negara Indonesia adalah…',
        o: ['Ringgit', 'Rupiah', 'Dollar', 'Baht'],
        a: 1,
        subject: 'IPS'
      },
      {
        q: 'Organisasi perhimpunan negara-negara di wilayah Asia Tenggara dinamakan…',
        o: ['APEC', 'ASEAN', 'OPEC', 'UNESCO'],
        a: 1,
        subject: 'IPS'
      },
      {
        q: 'Kerajaan Islam pertama yang tercatat di wilayah Nusantara adalah…',
        o: ['Demak', 'Samudera Pasai', 'Aceh Darussalam', 'Mataram Islam'],
        a: 1,
        subject: 'Sejarah'
      },
      {
        q: 'Gunung tertinggi di kepulauan Indonesia adalah Puncak Jaya yang terletak di…',
        o: ['Sumatra', 'Sulawesi', 'Kalimantan', 'Papua'],
        a: 3,
        subject: 'Geografi'
      },
      {
        q: 'Lembaga yang bertugas menyusun naskah dasar negara dalam sidang BPUPKI dipimpin oleh…',
        o: ['Dr. Radjiman Wedyodiningrat', 'Ir. Soekarno', 'Moh. Yamin', 'Mr. Soepomo'],
        a: 0,
        subject: 'Sejarah'
      },
      {
        q: 'Kegiatan menyalurkan barang atau jasa dari produsen ke konsumen disebut…',
        o: ['Produksi', 'Distribusi', 'Konsumsi', 'Investasi'],
        a: 1,
        subject: 'IPS'
      },
      {
        q: 'Lagu daerah "Gundul-Gundul Pacul" berasal dari provinsi…',
        o: ['Jawa Barat', 'Jawa Tengah', 'Jawa Timur', 'DI Yogyakarta'],
        a: 1,
        subject: 'Seni Budaya'
      }
    ]
  },
  {
    id: 'bahasa_indonesia',
    title: 'Bahasa Indonesia & Literasi',
    icon: '📖',
    subject: 'Bahasa Indonesia',
    description: 'Kosakata baku, sinonim-antonim, majas, dan kaidah kebahasaan.',
    questions: [
      {
        q: 'Penulisan kata baku yang benar menurut Kamus Besar Bahasa Indonesia (KBBI) adalah…',
        o: ['Apotik', 'Apotek', 'Apotic', 'Apotike'],
        a: 1,
        subject: 'Bahasa Indonesia'
      },
      {
        q: 'Antonim (lawan kata) dari kata "optimis" adalah…',
        o: ['Pesimis', 'Kritis', 'Dinamis', 'Pasif'],
        a: 0,
        subject: 'Bahasa Indonesia'
      },
      {
        q: 'Majas yang membandingkan benda mati seolah memiliki sifat hidup seperti manusia disebut…',
        o: ['Hiperbola', 'Personifikasi', 'Metafora', 'Litotes'],
        a: 1,
        subject: 'Bahasa Indonesia'
      },
      {
        q: 'Sinonim (persamaan kata) dari kata "akurat" adalah…',
        o: ['Cepat', 'Tepat', 'Ringkas', 'Indah'],
        a: 1,
        subject: 'Bahasa Indonesia'
      },
      {
        q: 'Kalimat utama yang berada di awal paragraf dinamakan paragraf…',
        o: ['Deduktif', 'Induktif', 'Campuran', 'Naratif'],
        a: 0,
        subject: 'Bahasa Indonesia'
      },
      {
        q: 'Peribahasa "Tong kosong nyaring bunyinya" memiliki arti…',
        o: ['Orang yang banyak bicara biasanya kurang berilmu', 'Orang miskin yang suka berderma', 'Barang murah yang mudah rusak', 'Orang sabar yang berhasil'],
        a: 0,
        subject: 'Bahasa Indonesia'
      },
      {
        q: 'Kalimat yang membutuhkan objek dalam susunannya disebut kalimat…',
        o: ['Transitif', 'Intransitif', 'Pasif', 'Majemuk'],
        a: 0,
        subject: 'Bahasa Indonesia'
      },
      {
        q: 'Penulisan kata serapan yang tepat adalah…',
        o: ['Praktek', 'Praktik', 'Praktiek', 'Praktix'],
        a: 1,
        subject: 'Bahasa Indonesia'
      },
      {
        q: 'Ungkapan "kambing hitam" bermakna kiasan berupa…',
        o: ['Hewan peliharaan', 'Orang yang dipersalahkan', 'Orang yang paling berani', 'Orang yang rajin'],
        a: 1,
        subject: 'Bahasa Indonesia'
      },
      {
        q: 'Kata penghubung seperti "dan, serta, tetapi" termasuk ke dalam kelompok kata…',
        o: ['Konjungsi', 'Preposisi', 'Adverbia', 'Pronomina'],
        a: 0,
        subject: 'Bahasa Indonesia'
      },
      {
        q: 'Karya sastra lama yang terikat oleh aturan rima A-B-A-B dan terdiri dari sampiran serta isi adalah…',
        o: ['Gurindam', 'Pantun', 'Syair', 'Hikayat'],
        a: 1,
        subject: 'Bahasa Indonesia'
      },
      {
        q: 'Penulisan judul buku yang tepat berdasarkan pedoman ejaan adalah…',
        o: ['Laskar Pelangi', 'laskar pelangi', 'LASKAR PELANGI', 'Laskar pelangi'],
        a: 0,
        subject: 'Bahasa Indonesia'
      },
      {
        q: 'Gagasan utama atau ide pokok yang menjadi dasar pengembangan sebuah cerita disebut…',
        o: ['Amanat', 'Tema', 'Alur', 'Latar'],
        a: 1,
        subject: 'Bahasa Indonesia'
      },
      {
        q: 'Penggunaan tanda baca yang tepat untuk mengakhiri kalimat tanya adalah…',
        o: ['Titik (.)', 'Koma (,)', 'Tanda tanya (?)', 'Tanda seru (!)'],
        a: 2,
        subject: 'Bahasa Indonesia'
      },
      {
        q: 'Bentuk kata ulang murni pada contoh di bawah ini adalah…',
        o: ['Kupu-kupu', 'Sayur-mayur', 'Buku-buku', 'Mondar-mandir'],
        a: 2,
        subject: 'Bahasa Indonesia'
      }
    ]
  },
  {
    id: 'trivia_logika',
    title: 'Trivia & Logika Pengetahuan Umum',
    icon: '🧩',
    subject: 'Umum & Trivia',
    description: 'Pengetahuan dunia, teknologi, sains populer, dan teka-teki logika seru.',
    questions: [
      {
        q: 'Hewan mamalia terbesar di muka bumi yang hidup hingga saat ini adalah…',
        o: ['Gajah Afrika', 'Paus Biru', 'Hiu Paus', 'Jerapah'],
        a: 1,
        subject: 'Umum'
      },
      {
        q: 'Sistem operasi open-source berlogo robot hijau pada ponsel pintar adalah…',
        o: ['iOS', 'Windows Phone', 'Android', 'Symbian'],
        a: 2,
        subject: 'Teknologi'
      },
      {
        q: 'Siapakah penemu bola lampu pijar yang paling terkenal dalam sejarah?',
        o: ['Thomas Alva Edison', 'Nikola Tesla', 'Alexander Graham Bell', 'Albert Einstein'],
        a: 0,
        subject: 'Sains'
      },
      {
        q: 'Benua terkecil di dunia berdasarkan luas daratan adalah…',
        o: ['Eropa', 'Australia', 'Antartika', 'Amerika Selatan'],
        a: 1,
        subject: 'Geografi'
      },
      {
        q: 'Negara di dunia yang terkenal dengan julukan "Negeri Sakura" adalah…',
        o: ['Korea Selatan', 'Tiongkok', 'Jepang', 'Thailand'],
        a: 2,
        subject: 'Umum'
      },
      {
        q: 'Simbol kimia untuk unsur Emas pada tabel periodik adalah…',
        o: ['Ag', 'Au', 'Fe', 'Cu'],
        a: 1,
        subject: 'Kimia'
      },
      {
        q: 'Berapakah jumlah warna primer dasar dalam teori warna aditif cahaya?',
        o: ['2', '3', '4', '7'],
        a: 1,
        subject: 'Sains'
      },
      {
        q: 'Satuan penyimpanan memori komputer di bawah ini yang paling besar adalah…',
        o: ['Kilobyte (KB)', 'Megabyte (MB)', 'Gigabyte (GB)', 'Terabyte (TB)'],
        a: 3,
        subject: 'Teknologi'
      },
      {
        q: 'Menara lonceng jam raksasa terkenal "Big Ben" berada di kota…',
        o: ['Paris', 'London', 'New York', 'Berlin'],
        a: 1,
        subject: 'Umum'
      },
      {
        q: 'Berapakah total tuts putih dan hitam pada tuts piano standar?',
        o: ['76', '84', '88', '92'],
        a: 2,
        subject: 'Seni'
      },
      {
        q: 'Burung yang tidak dapat terbang tetapi merupakan perenang handal di kutub adalah…',
        o: ['Burung Unta', 'Pinguin', 'Kiwi', 'Kasuari'],
        a: 1,
        subject: 'Biologi'
      },
      {
        q: 'Bahasa pemrograman web yang biasa digunakan untuk mengatur logika interaktif di browser adalah…',
        o: ['HTML', 'CSS', 'JavaScript', 'SQL'],
        a: 2,
        subject: 'Teknologi'
      },
      {
        q: 'Lukisan potret terkenal "Mona Lisa" dilukis oleh seniman bernama…',
        o: ['Vincent van Gogh', 'Leonardo da Vinci', 'Pablo Picasso', 'Michelangelo'],
        a: 1,
        subject: 'Seni'
      },
      {
        q: 'Olimpiade modern pertama diadakan pada tahun 1896 di kota…',
        o: ['Roma', 'Athena', 'Paris', 'London'],
        a: 1,
        subject: 'Olahraga'
      },
      {
        q: 'Organ sensorik pada tubuh manusia yang bertanggung jawab atas indera keseimbangan adalah…',
        o: ['Mata', 'Telinga dalam', 'Hidung', 'Lidah'],
        a: 1,
        subject: 'Biologi'
      }
    ]
  }
];
