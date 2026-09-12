import Image from "next/image";
import UserChip from "./UserChip";

export default function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="topbar">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="topbar-logos">
        <Image src="/school-logo.png" alt="شعار مدارس المشكاة الأهلية" width={58} height={58} className="logo-img" />
        <Image src="/guidance-logo.png" alt="شعار التوجيه الطلابي" width={72} height={58} className="logo-img wide" />
        <UserChip />
      </div>
    </header>
  );
}
