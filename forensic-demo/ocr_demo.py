import pytesseract
from PIL import Image

# Explicitly point to tesseract.exe if not in PATH
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

image_path = r"D:\forensivault\test_image.png"
text = pytesseract.image_to_string(Image.open(image_path))

print("Extracted Text:")
print(text)

keyword = "hello"
if keyword.lower() in text.lower():
    print(f"✅ Keyword '{keyword}' FOUND in image!")
else:
    print(f"❌ Keyword '{keyword}' NOT found.")
