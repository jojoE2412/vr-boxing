# Cara Menjalankan VR Boxing

1. Sambungkan komputer dan perangkat pemain ke Wi-Fi yang sama.
2. Buka PowerShell di folder project. Jika baru pertama kali menjalankan project, pasang dependensi:

   ```powershell
   npm install
   ```

3. Jalankan game:

   ```powershell
   npm run dev
   ```

4. Lihat alamat **Network** yang muncul di terminal. Buka alamat Wi-Fi komputer di PC dan headset, misalnya:

   ```text
   https://192.168.1.37:4173/
   ```

   Jika ada beberapa alamat Network, gunakan alamat adapter Wi-Fi. Jangan gunakan alamat `vEthernet` atau `localhost` di headset.

5. Jika browser menampilkan peringatan sertifikat (**Not secure**), pilih **Advanced / Lanjutan**, lalu **Proceed / Lanjutkan ke situs**.

Biarkan PowerShell yang menjalankan `npm run dev` tetap terbuka selama bermain. Untuk multiplayer, kedua pemain membuka alamat yang sama dan komputer host harus tetap menyala.
