// File ini cuma buat tes pre-commit
// Harusnya semua komentar ilang total

/*
  Multi-line comment di awal
  baris kedua
*/

/**
 * Kadang orang suka bikin JSDoc palsu
 * @param {string} name
 */
function greet(name) {
  // print nama orang
  console.log('Hai ' + name) // inline komentar
  /*
      komentar di tengah fungsi
      biar tambah rame
    */
  const msg = `Halo, ${name}!` // komentar lagi
  console.log(msg)
}

// baris kosong banyak banget di bawah

/* komentar sebelum fungsi kedua */
function sum(a, b) {
  // tambah dua angka
  return a + b /* jangan lupa ini komentar inline juga */
}

// komentar di akhir file
// bener-bener terakhir
