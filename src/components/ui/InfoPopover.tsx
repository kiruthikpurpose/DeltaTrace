import { Info } from 'lucide-react';
import { Popover } from './Popover';

export function InfoPopover({ title = 'Help', bullets }: { title?: string; bullets: string[] }) {
  return (
    <Popover label={title} trigger={<><Info size={14} aria-hidden /> <span>{title}</span></>}>
      <b>{title}</b>
      <ul>
        {bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    </Popover>
  );
}
