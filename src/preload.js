'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');
const inv = (k) => (...a) => ipcRenderer.invoke(k, ...a);

contextBridge.exposeInMainWorld('bc', {
  trangThai: inv('trangThai'),
  duongDanTep: f => webUtils.getPathForFile(f),
  taiKhoan: { them: inv('taiKhoan.them'), xoa: inv('taiKhoan.xoa'), dangNhap: inv('taiKhoan.dangNhap') },
  quet: { ngay: inv('quet.ngay'), dung: inv('quet.dung') },
  kho: { tim: inv('kho.tim'), layTheoSo: inv('kho.layTheoSo'), moGoc: inv('kho.moGoc') },
  baoCao: {
    chonTep: inv('baoCao.chonTep'), napDeCuong: inv('baoCao.napDeCuong'), napBieuMau: inv('baoCao.napBieuMau'), napChuDe: inv('baoCao.napChuDe'),
    phanTich: inv('baoCao.phanTich'), capNhatMuc: inv('baoCao.capNhatMuc'), chonTrich: inv('baoCao.chonTrich'),
    tinhChinh: inv('baoCao.tinhChinh'), boVanAi: inv('baoCao.boVanAi'), xuat: inv('baoCao.xuat'), moThuMuc: inv('baoCao.moThuMuc')
  },
  caiDat: { ghi: inv('caiDat.ghi'), chonThuMuc: inv('caiDat.chonThuMuc') },
  ghiNhan: { bat: inv('ghiNhan.bat'), lay: inv('ghiNhan.lay') },
  onTrangThai: cb => ipcRenderer.on('trangThai', (_e, s) => cb(s)),
  onTienDo: cb => ipcRenderer.on('tienDo', (_e, p) => cb(p))
});
