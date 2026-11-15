import { CalendarPlus, ChevronDown, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { downloadCalendarIcs, googleCalendarUrl, outlookCalendarUrl, type CalendarEvent } from "@/lib/calendar";

export function AddToCalendarDropdown({ event }: { event: CalendarEvent }) {
  let google: string;
  let outlook: string;
  try {
    google = googleCalendarUrl(event);
    outlook = outlookCalendarUrl(event);
  } catch {
    return <Button variant="outline" className="w-full rounded-full" disabled><CalendarPlus strokeWidth={1.5} /> Calendar unavailable</Button>;
  }
  const download = () => {
    try { downloadCalendarIcs(event); }
    catch { toast.error("Couldn't download this event. Please try again."); }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="w-full rounded-full"><CalendarPlus strokeWidth={1.5} /> Add to calendar <ChevronDown strokeWidth={1.5} /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 max-w-[calc(100vw-3rem)]">
        <DropdownMenuItem asChild><a href={google} target="_blank" rel="noopener noreferrer"><ExternalLink strokeWidth={1.5} /> Google Calendar</a></DropdownMenuItem>
        <DropdownMenuItem asChild><a href={outlook} target="_blank" rel="noopener noreferrer"><ExternalLink strokeWidth={1.5} /> Outlook / Office 365</a></DropdownMenuItem>
        <DropdownMenuItem onSelect={download}><Download strokeWidth={1.5} /> Apple Calendar</DropdownMenuItem>
        <DropdownMenuItem onSelect={download}><Download strokeWidth={1.5} /> Other calendar</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}