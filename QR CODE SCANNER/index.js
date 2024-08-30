const express = require("express");
const multer = require("multer");
const Jimp = require("jimp");
const QrCode = require("qrcode-reader");
const path = require("path");
const fs = require("fs");

const app = express();
const port = 3001;

// Set storage engine for multer
const storage = multer.diskStorage({
  destination: "./uploads/",
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

// Initialize upload
const upload = multer({
  storage: storage,
  limits: { fileSize: 1000000 }, // 1MB limit
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  },
}).single("qrImage");

// Check file type
function checkFileType(file, cb) {
  const filetypes = /jpeg|jpg|png|gif/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb("Error: Images Only!");
  }
}

// Serve static files from 'public' directory
app.use(express.static("public"));

// Route to handle file upload and QR code scanning
app.post("/upload", (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      res.send(err);
    } else {
      if (req.file == undefined) {
        res.send("Error: No File Selected!");
      } else {
        // Scan the QR code
        Jimp.read(req.file.path, (err, image) => {
          if (err) {
            console.error(err);
            res.send("Error reading the image file!");
            return;
          }

          const qr = new QrCode();
          qr.callback = (err, value) => {
            if (err) {
              console.error(err);
              res.send("Error decoding the QR code!");
              return;
            }

            // Send the result back to the client
            res.send(`QR Code Result: ${value.result}`);

            // Optionally, delete the uploaded file after processing
            fs.unlinkSync(req.file.path);
          };

          qr.decode(image.bitmap);
        });
      }
    }
  });
});

// Start server
app.listen(port, () => console.log(`Server running on port ${port}`));

// HTML and JavaScript for frontend
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>QR Code Scanner</title>
    </head>
    <body>
      <div style="text-align: center;">
        <h1>QR Code Scanner</h1>
        <form id="uploadForm" enctype="multipart/form-data">
          <input type="file" name="qrImage" accept="image/*" required>
          <button type="submit">Upload and Scan QR Code</button>
        </form>
        <div id="result"></div>
      </div>
      <script>
        document.getElementById('uploadForm').addEventListener('submit', async (event) => {
          event.preventDefault();
          const formData = new FormData(event.target);
          const response = await fetch('/upload', {
            method: 'POST',
            body: formData
          });
          const result = await response.text();
          document.getElementById('result').innerText = result;
        });
      </script>
    </body>
    </html>
  `);
});
