const OFFICIAL_MYASTORIYA_LOGO =
  "https://myastoriya.com.ua/frontend/myastoriya/dist/images/logo.png";

export function SidebarBrand() {
  return (
    <div className="brand">
      <div className="brand-official">
        <img
          src={OFFICIAL_MYASTORIYA_LOGO}
          alt="М'ЯСТОРІЯ"
          className="brand-logo-official"
        />
        <span>CONTROL CENTER</span>
      </div>
    </div>
  );
}
