"""Sinh test/mau/scan-gia.pdf: PDF một trang CHỈ có ảnh (giống bản scan), chữ giả tiếng Việt, để self-test OCR trong CI.
Chạy: python3 tools/tao-scan-gia.py"""
from PIL import Image, ImageDraw, ImageFont
import os, glob

fonts = [f for f in glob.glob('/usr/share/fonts/**/*.ttf', recursive=True) if 'DejaVuSerif.ttf' in f or 'LiberationSerif-Regular' in f]
font = ImageFont.truetype(fonts[0], 34)
img = Image.new('L', (1654, 2339), 255)  # A4 200 dpi
d = ImageDraw.Draw(img)
dong = ['SỞ NÔNG NGHIỆP VÀ MÔI TRƯỜNG', '', 'BÁO CÁO THỬ NGHIỆM', '',
        'Đã hoàn thành giải phóng mặt bằng 12,5 ha cho 3 dự án.',
        'Văn bản này là dữ liệu giả dùng để kiểm tra nhận dạng chữ.']
y = 200
for t in dong:
    d.text((160, y), t, fill=0, font=font)
    y += 70
out = os.path.join(os.path.dirname(__file__), '..', 'test', 'mau', 'scan-gia.pdf')
img.save(out, 'PDF', resolution=200)
print('Đã tạo', out)
