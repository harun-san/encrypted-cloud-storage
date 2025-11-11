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
      const u8 = new Uint8Array(e.target.result);
      const wordArray = CryptoJS.lib.WordArray.create(u8);
      const encryptedBase64 = CryptoJS.AES.encrypt(wordArray, key).toString();
      const encryptedUint8 = base64ToUint8Array(encryptedBase64);
      const blob = new Blob([encryptedUint8], { type: "application/octet-stream" });
      const filePath = `${userData.user.id}/${file.name}.enc`;

      const { error: uploadError } = await supabase.storage
        .from("secure-files")
        .upload(filePath, blob, { upsert: true });

      if (uploadError) throw uploadError;

      // Tampilkan link hasil upload sementara (opsional)
      const { data: signedData, error: signedError } = await supabase.storage
        .from("secure-files")
        .createSignedUrl(filePath, 3600);

      let publicHref = signedData?.signedUrl || "";
      downloadLink.textContent = file.name + ".enc";
      downloadLink.href = publicHref;
      downloadLink.setAttribute("download", file.name + ".enc");
      output.classList.remove("hidden");

      alert("File terenkripsi dan berhasil diupload!");
      await listUserFiles(userData.user.id); // refresh daftar file otomatis
    } catch (err) {
      alert("Gagal upload: " + (err.message || JSON.stringify(err)));
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
});

// === LIST FILES milik user dan render ===
async function listUserFiles(userId) {
  fileList.innerHTML = "<p>Memuat daftar file...</p>";
  try {
    const { data, error } = await supabase.storage
      .from("secure-files")
      .list(userId, { limit: 200, offset: 0, sortBy: { column: "name", order: "asc" } });

    if (error) throw error;

    if (!data || data.length === 0) {
      fileList.innerHTML = "<p>Belum ada file yang diupload.</p>";
      return;
    }

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
      btnDownload.addEventListener("click", () => downloadDecryptedFile(`${userId}/${file.name}`, file.name));

      row.appendChild(name);
      row.appendChild(btnDownload);
      fileList.appendChild(row);
    });
  } catch (err) {
    fileList.innerHTML = "<p>Gagal memuat daftar file.</p>";
    console.error(err);
  }
}

// === DOWNLOAD & DEKRIPSI FILE ===
async function downloadDecryptedFile(path, filename) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return alert("Harus login dulu!");

  const key = prompt("Masukkan kunci enkripsi untuk mendekripsi file:"); 
  if (!key) return alert("Kunci tidak boleh kosong!");

  try {
    const { data: fileBlob, error } = await supabase.storage
      .from("secure-files")
      .download(path);
    if (error) throw error;

    const arrayBuffer = await fileBlob.arrayBuffer();
    const u8 = new Uint8Array(arrayBuffer);
    const wordArray = CryptoJS.lib.WordArray.create(u8);

    // dekripsi
    const decrypted = CryptoJS.AES.decrypt({ ciphertext: wordArray }, key);

    const decryptedBytes = new Uint8Array(decrypted.sigBytes);
    for (let i = 0; i < decrypted.sigBytes; i++) {
      decryptedBytes[i] = decrypted.words[i >>> 2] >>> (24 - (i % 4) * 8) & 0xff;
    }

    const decryptedBlob = new Blob([decryptedBytes], { type: "application/octet-stream" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(decryptedBlob);
    a.download = filename.replace(/\.enc$/, "");
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);

  } catch (err) {
    alert("Gagal download atau dekripsi: " + (err.message || JSON.stringify(err)));
    console.error(err);
  }
}
