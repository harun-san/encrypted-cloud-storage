// === KONEKSI KE SUPABASE ===
const { createClient } = window.supabase;
const supabase = createClient(
  "https://ghxmmdfpfsljqxuosusg.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoeG1tZGZwZnNsanF4dW9zdXNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MTY0ODAsImV4cCI6MjA4MzE5MjQ4MH0.c6YDawbf9rwggJTlrfP8ZLWzyf4hxomGdbTZ_Ms3deY"
);

const CryptoJS = window.CryptoJS;

// === DOM ===
const authSection = document.getElementById("auth-section");
const uploadSection = document.getElementById("upload-section");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const registerBtn = document.getElementById("register-btn");
const logoutBtn = document.getElementById("logout-btn");
const helpSection = document.getElementById("help-section");
const userEmail = document.getElementById("user-email");
const fileInput = document.getElementById("file-input");
const keyInput = document.getElementById("key");
const uploadBtn = document.getElementById("encrypt-upload");
const output = document.getElementById("output");
const downloadLink = document.getElementById("download-link");
const fileList = document.getElementById("file-list");

// === UTIL: konversi WordArray <-> Uint8Array ===
function wordArrayToUint8Array(wordArray) {
  const words = wordArray.words;
  const sigBytes = wordArray.sigBytes;
  const u8 = new Uint8Array(sigBytes);
  let idx = 0;
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const b0 = (word >>> 24) & 0xff;
    const b1 = (word >>> 16) & 0xff;
    const b2 = (word >>> 8) & 0xff;
    const b3 = word & 0xff;
    if (idx < sigBytes) u8[idx++] = b0;
    if (idx < sigBytes) u8[idx++] = b1;
    if (idx < sigBytes) u8[idx++] = b2;
    if (idx < sigBytes) u8[idx++] = b3;
    if (idx >= sigBytes) break;
  }
  return u8;
}

// === VALIDASI EMAIL ===
function isRealEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// === BANTUAN: cek apakah email sudah terdaftar (BEST-EFFORT) ===
// Mencoba query pada tabel 'profiles' (konvensi umum). Jika tidak ada tabel tersebut,
// fungsi ini akan mengembalikan null (unknown). Jika ada dan ada data -> true/false.
async function checkEmailRegisteredByProfile(email) {
  try {
    // NOTE: jika proyekmu tidak memiliki tabel 'profiles' dengan kolom email, query ini akan gagal.
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .limit(1);

    if (error) {
      // tabel mungkin tidak ada atau tidak dapat diakses oleh anon key
      return null; // unknown
    }
    return Array.isArray(data) && data.length > 0;
  } catch (err) {
    return null;
  }
}

// ===================== REGISTER =====================
registerBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const pass = passwordInput.value.trim();

  // Validasi input kosong
  if (!email && !pass) {
    return alert("masukkan email anda!"); // prefer show email first per rules (5)
  }
  if (!email) {
    return alert("masukkan email anda!"); // rule 5
  }
  if (!pass) {
    return alert("masukkan password anda!"); // rule 4
  }

  // Validasi email format
  if (!isRealEmail(email)) {
    return alert("Email tidak valid, gunakan email asli");
  }

  // Validasi panjang password (rule 8)
  if (pass.length < 6) {
    return alert("kata sandi harus memiliki setidaknya enam karakter, yang bisa berupa huruf, angka, atau simbol");
  }

  try {
    // Coba daftar
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password: pass });

    if (signUpError) {
      const msg = (signUpError.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("duplicate") || msg.includes("user already")) {
        // rule 7
        return alert("email anda sudah terdaftar, silahkan login!");
      }
      // fallback untuk error lain
      return alert("Registrasi gagal: " + (signUpError.message || JSON.stringify(signUpError)));
    }

    // rule 6
    alert("Registrasi berhasil! Silakan cek email anda dan klik link verifikasi sebelum login.");
  } catch (err) {
    console.error(err);
    alert("Registrasi gagal: " + (err.message || JSON.stringify(err)));
  }
});

// ===================== LOGIN =====================
loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const pass = passwordInput.value.trim();

  // Validasi field kosong (rule 4 & 5)
  if (!email && !pass) {
    return alert("masukkan email anda!");
  }
  if (!email) return alert("masukkan email anda!"); // rule 5
  if (!pass) return alert("masukkan password anda!"); // rule 4

  // Format email valid?
  if (!isRealEmail(email)) {
    // treat as not registered / invalid email format
    return alert("email anda belum terdaftar, klik register!"); // prefer rule 3 style
  }

  // Best-effort: cek apakah email terdaftar via tabel profiles (jika tersedia)
  const emailRegisteredFlag = await checkEmailRegisteredByProfile(email); // true / false / null

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });

    if (error) {
      // jika ada error, kita gunakan deteksi terbaik:
      const emsg = (error.message || "").toLowerCase();

      // Jika kita tahu email terdaftar => kemungkinan password salah
      if (emailRegisteredFlag === true) {
        return alert("maaf, password anda salah!"); // rule 2
      }

      // Jika kita tahu email tidak terdaftar
      if (emailRegisteredFlag === false) {
        return alert("email anda belum terdaftar, klik register!"); // rule 3
      }

      // Jika unknown, gunakan heuristik dari pesan error Supabase
      if (emsg.includes("invalid login credentials") || emsg.includes("invalid")) {
        // biasanya itu password salah OR email tidak ada; default ke password salah
        return alert("maaf, password anda salah!"); // rule 2 (heuristic)
      }

      if (emsg.includes("user not found") || emsg.includes("no user") || emsg.includes("not found")) {
        return alert("email anda belum terdaftar, klik register!"); // rule 3
      }

      // fallback generic
      return alert("Login gagal: " + (error.message || JSON.stringify(error)));
    }

    // Jika sukses: data.user tersedia
    const user = data.user || (data?.user ?? null);
    if (!user) {
      // tak terduga
      return alert("Login gagal: tidak ada data user.");
    }

    // Cek verifikasi email: jika ada field email_confirmed_at
    // Jika ada dan null => belum verifikasi
    // Jika field tidak tersedia, kita juga bisa memanggil supabase.auth.getUser() untuk memastikan
    const confirmedAt = user.email_confirmed_at ?? null;

    if (confirmedAt === null) {
      // rule 10: belum verifikasi -> tidak boleh login
      // untuk memastikan tidak ada sesi tersisa, signOut
      await supabase.auth.signOut();
      return alert("klik link verifikasi terlebih dahulu");
    }

    // Jika sampai sini, login berhasil dan terverifikasi
    // rule 1 -> "lanjutkan login."
    alert("lanjutkan login.");

    // refresh atau update UI (tetap di index.html sesuai pilihan)
    location.reload();
  } catch (err) {
    console.error(err);
    alert("Login gagal: " + (err.message || JSON.stringify(err)));
  }
});

// ===================== LOGOUT =====================
logoutBtn.addEventListener("click", async () => {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("logout error", err);
  }
  location.reload();
});

// ===================== CEK STATUS LOGIN PADA LOAD =====================
async function checkUser() {
  try {
    const { data } = await supabase.auth.getUser();

    // data memiliki bentuk { user: ... } jika ada session
    const user = data?.user ?? null;
    if (user) {
      // jika user ada, cek verifikasi
      const confirmedAt = user.email_confirmed_at ?? null;

      if (confirmedAt === null) {
        // user belum verifikasi -> jangan izinkan akses
        // langsung sign out untuk memastikan tidak ada sesi aktif
        await supabase.auth.signOut();
        authSection.classList.remove("hidden");
        uploadSection.classList.add("hidden");
        if (helpSection) helpSection.classList.remove("hidden");
        return alert("klik link verifikasi terlebih dahulu");
      }

      // jika terverifikasi -> tampilkan upload
      authSection.classList.add("hidden");
      if (helpSection) helpSection.classList.add("hidden");
      uploadSection.classList.remove("hidden");
      userEmail.textContent = "Login sebagai: " + user.email;

      // aktifkan upload
      uploadBtn.disabled = false;

      await listUserFiles(user.id);
    } else {
      authSection.classList.remove("hidden");
      uploadSection.classList.add("hidden");
    }
  } catch (err) {
    console.error("checkUser error", err);
    authSection.classList.remove("hidden");
    uploadSection.classList.add("hidden");
  }
}
checkUser();

// ===================== ENKRIPSI & UPLOAD (TIDAK DIUBAH) =====================
uploadBtn.addEventListener("click", async () => {
  const { data: session } = await supabase.auth.getUser();
  if (!session?.user) return alert("Harus login!");

  const file = fileInput.files[0];
  const key = keyInput.value;

  if (!file || !key) return alert("Lengkapi semua data!");

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const bytes = new Uint8Array(e.target.result);
      const wordArray = CryptoJS.lib.WordArray.create(bytes);
      const encryptedBase64 = CryptoJS.AES.encrypt(wordArray, key).toString();
      const blob = new Blob([encryptedBase64], { type: "text/plain;charset=utf-8" });
      const path = `${session.user.id}/${file.name}.enc`;

      const { error } = await supabase.storage
        .from("secure-files")
        .upload(path, blob, { upsert: true });

      if (error) throw error;

      alert("File terenkripsi & berhasil diupload!");
      await listUserFiles(session.user.id);
    } catch (err) {
      console.error(err);
      alert("Gagal upload: " + (err.message || JSON.stringify(err)));
    }
  };

  reader.readAsArrayBuffer(file);
});

// ===================== LIST FILE =====================
async function listUserFiles(uid) {
  try {
    const { data } = await supabase.storage.from("secure-files")
      .list(uid, { limit: 200 });

    fileList.innerHTML = "";

    if (!data || data.length === 0) {
      fileList.innerHTML = "<p>Belum ada file.</p>";
      return;
    }

    data.forEach(file => {
      const row = document.createElement("div");
      row.className = "file-row";

      const name = document.createElement("span");
      name.className = "file-name";
      name.textContent = file.name;

      const dl = document.createElement("button");
      dl.className = "file-download-btn";
      dl.textContent = "Download";

      dl.addEventListener("click", () => downloadDecryptedFile(`${uid}/${file.name}`, file.name));

      row.appendChild(name);
      row.appendChild(dl);
      fileList.appendChild(row);
    });
  } catch (err) {
    console.error("listUserFiles error", err);
    fileList.innerHTML = "<p>Gagal memuat daftar file.</p>";
  }
}

// ===================== DOWNLOAD & DEKRIPSI =====================
async function downloadDecryptedFile(path, filename) {
  const key = prompt("Masukkan kunci enkripsi:");
  if (!key) return;

  try {
    const { data: blobData, error: downloadError } = await supabase.storage.from("secure-files").download(path);
    if (downloadError) throw downloadError;

    const ciphertextBase64 = await blobData.text();
    const decryptedWordArray = CryptoJS.AES.decrypt(ciphertextBase64, key);

    if (!decryptedWordArray || !decryptedWordArray.sigBytes || decryptedWordArray.sigBytes === 0) {
      return alert("Gagal dekripsi: kunci salah atau file tidak valid.");
    }

    const plainBytes = wordArrayToUint8Array(decryptedWordArray);
    const plainBlob = new Blob([plainBytes], { type: "application/octet-stream" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(plainBlob);
    a.download = filename.replace(/\.enc$/i, "");
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  } catch (err) {
    console.error(err);
    alert("Gagal download atau dekripsi: " + (err.message || JSON.stringify(err)));
  }
}

