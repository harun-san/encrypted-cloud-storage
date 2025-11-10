// === KONEKSI KE SUPABASE ===
const { createClient } = window.supabase;
const supabase = createClient(
  "https://gdcunyctbofxewtxokrg.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkY3VueWN0Ym9meGV3dHhva3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3ODk4NjYsImV4cCI6MjA3ODM2NTg2Nn0.9SfCpJxx8HByLSJ3BsJ1FjwkzY3jnOxhIcLuUm_IkPI"
);

// === INISIALISASI CRYPTOJS ===
const CryptoJS = window.CryptoJS;

// === AMBIL ELEMEN DOM ===
const authSection = document.getElementById("auth-section");
const uploadSection = document.getElementById("upload-section");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const registerBtn = document.getElementById("register-btn");
const logoutBtn = document.getElementById("logout-btn");
const fileInput = document.getElementById("file-input");
const keyInput = document.getElementById("key");
const uploadBtn = document.getElementById("encrypt-upload");
const userEmail = document.getElementById("user-email");
const output = document.getElementById("output");
const downloadLink = document.getElementById("download-link");
const fileList = document.getElementById("file-list");

// === AUTH LOGIN / REGISTER ===
loginBtn.addEventListener("click", async () => {
  const { error } = await supabase.auth.signInWithPassword({
    email: emailInput.value,
    password: passwordInput.value
  });
  if (error) alert("Login gagal: " + error.message);
  else location.reload();
});

registerBtn.addEventListener("click", async () => {
  const { error } = await supabase.auth.signUp({
    email: emailInput.value,
    password: passwordInput.value
  });
  if (error) alert("Registrasi gagal: " + error.message);
  else alert("Registrasi berhasil! Silakan login.");
});

logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  location.reload();
});

// === CEK STATUS LOGIN ===
async function checkUser() {
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    authSection.classList.add("hidden");
    uploadSection.classList.remove("hidden");
    userEmail.textContent = "Login sebagai: " + data.user.email;
    // isi daftar file user
    await listUserFiles(data.user.id);
  } else {
    authSection.classList.remove("hidden");
    uploadSection.classList.add("hidden");
  }
}
checkUser();

// === UTIL: convert base64 string to Uint8Array ===
function base64ToUint8Array(base64) {
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return arr;
}

// === ENKRIPSI DAN UPLOAD ===
uploadBtn.addEventListener("click", async () => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return alert("Harus login dulu!");

  const file = fileInput.files[0];
  const key = keyInput.value;
  if (!file || !key) return alert("Lengkapi semua data!");

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      // --- Buat WordArray dari ArrayBuffer (biner) ---
      const u8 = new Uint8Array(e.target.result);
      const wordArray = CryptoJS.lib.WordArray.create(u8);

      // --- Enkripsi (hasilnya Base64 string) ---
      const encryptedBase64 = CryptoJS.AES.encrypt(wordArray, key).toString();

      // --- Jadikan binary dari base64 agar upload sebagai file biner (.enc) ---
      const encryptedUint8 = base64ToUint8Array(encryptedBase64);
      const blob = new Blob([encryptedUint8], { type: "application/octet-stream" });

      // --- Path disimpan di folder user.id supaya tiap user punya folder sendiri ---
      const filePath = `${userData.user.id}/${file.name}.enc`;

      // Upload ke Supabase Storage (bucket "secure-files")
      const { error: uploadError } = await supabase.storage
        .from("secure-files")
        .upload(filePath, blob, { upsert: true });

      if (uploadError) throw uploadError;

      // Usahakan pakai signed URL agar private (jika bucket private). 
      // Kita minta signed URL yang valid 1 jam (3600 detik)
      const { data: signedData, error: signedError } = await supabase.storage
        .from("secure-files")
        .createSignedUrl(filePath, 3600);

      let publicHref = "";
      if (signedError || !signedData?.signedUrl) {
        // fallback: getPublicUrl (jika bucket publik)
        const { data: pu, error: puErr } = supabase.storage.from("secure-files").getPublicUrl(filePath);
        if (puErr) throw puErr;
        publicHref = pu.publicUrl;
      } else {
        publicHref = signedData.signedUrl;
      }

      // Tampilkan link hasil upload
      downloadLink.textContent = file.name + ".enc";
      downloadLink.href = publicHref;
      // agar browser mengunduh file (bukan membuka dalam tab), set attribute download
      downloadLink.setAttribute("download", file.name + ".enc");
      output.classList.remove("hidden");

      alert("File terenkripsi dan berhasil diupload!");
      // refresh daftar file
      await listUserFiles(userData.user.id);
    } catch (err) {
      alert("Gagal upload: " + (err.message || JSON.stringify(err)));
      console.error(err);
    }
  };
  // baca sebagai ArrayBuffer supaya kita dapat biner asli
  reader.readAsArrayBuffer(file);
});

// === LIST FILES milik user dan render ===
async function listUserFiles(userId) {
  fileList.innerHTML = "<p>Memuat daftar file...</p>";
  try {
    // list semua object dalam folder userId
    const { data, error } = await supabase.storage
      .from("secure-files")
      .list(userId, { limit: 200, offset: 0, sortBy: { column: "name", order: "asc" } });

    if (error) throw error;

    if (!data || data.length === 0) {
      fileList.innerHTML = "<p>Belum ada file yang diupload.</p>";
      return;
    }

    // buat elemen list
    fileList.innerHTML = "";
    data.forEach((file) => {
      const row = document.createElement("div");
      row.className = "file-row";

      const name = document.createElement("span");
      name.textContent = file.name;
      name.className = "file-name";

      const btnDownload = document.createElement("button");
      btnDownload.textContent = "Download";
      btnDownload.className = "file-download-btn";
      btnDownload.addEventListener("click", () => downloadEncryptedFile(`${userId}/${file.name}`, file.name));

      row.appendChild(name);
      row.appendChild(btnDownload);
      fileList.appendChild(row);
    });
  } catch (err) {
    fileList.innerHTML = "<p>Gagal memuat daftar file.</p>";
    console.error(err);
  }
}

// === DOWNLOAD: buat signed URL lalu buka / download ===
async function downloadEncryptedFile(path, filename) {
  try {
    // Mencoba bikin signed URL (lebih aman) — expire 300 detik (5 menit)
    const { data: signedData, error: signedError } = await supabase.storage
      .from("secure-files")
      .createSignedUrl(path, 300);

    let url = "";
    if (signedError || !signedData?.signedUrl) {
      // fallback: public url
      const { data: pu, error: puErr } = supabase.storage.from("secure-files").getPublicUrl(path);
      if (puErr) throw puErr;
      url = pu.publicUrl;
    } else {
      url = signedData.signedUrl;
    }

    // Buat link sementara untuk mendownload
    const a = document.createElement("a");
    a.href = url;
    a.download = filename; // akan minta browser mengunduh
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err) {
    alert("Gagal membuat link download: " + (err.message || JSON.stringify(err)));
    console.error(err);
  }
}
