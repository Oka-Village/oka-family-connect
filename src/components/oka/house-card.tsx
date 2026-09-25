import { Link } from "@tanstack/react-router";
import { Home, MapPin } from "lucide-react";

import { MemberAvatar } from "@/components/oka/profile-sections";
import { PROPERTY_LABELS, type SignedHouse } from "@/lib/houses";

export function HouseCard({ house }: { house: SignedHouse }) {
  const hero = house.photoUrls[0];
  return (
    <Link to="/houses/$houseId" params={{ houseId: house.id }} className="surface-card group flex flex-col overflow-hidden transition-shadow hover:shadow-lifted">
      {hero ? (
        <img src={hero} alt="" className="aspect-[4/3] w-full object-cover" />
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center bg-secondary/70"><Home className="size-10 text-primary" strokeWidth={1.25} /></div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <span className="w-fit rounded-full bg-accent px-3 py-0.5 text-xs uppercase tracking-widest text-accent-foreground">{PROPERTY_LABELS[house.property_type]}</span>
        <h3 className="mt-3 font-serif text-2xl leading-tight text-foreground group-hover:text-primary">{house.title}</h3>
        {house.location_text && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="size-3.5 text-primary" strokeWidth={1.5} />{house.location_text}</p>
        )}
        <div className="mt-auto flex items-center gap-2 pt-5">
          <MemberAvatar src={house.hostPhoto} name={house.owner?.display_name} className="size-7" />
          <span className="text-sm text-foreground">{house.owner?.display_name ?? "Oka member"}</span>
        </div>
      </div>
    </Link>
  );
}
