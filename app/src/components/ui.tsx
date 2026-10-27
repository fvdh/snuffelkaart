import type { ReactNode } from 'react';
import type { Item } from '../lib/model';
import { dDay } from '../lib/model';
import type { Status } from '../lib/hours';

export const Ic = ({ n, className = '' }: { n: string; className?: string }) => (
  <svg className={`i ${className}`} aria-hidden="true"><use href={`#i-${n}`} /></svg>
);

export const isUnsure = (it: Item) => (it.t === 'm' ? it.status === 'unconf' : !it.h);
/** Tweedehandswinkel: geen standaard kringloop, eigen icoon en tint. */
export const isTw = (it: Item) => it.t === 'k' && it.kind === 'tweedehands';
export const kindIcon = (it: Item) => it.t === 'm' ? 'kraam' : isTw(it) ? 'hanger' : 'tag';
/** Bewegingen uit het ontwerp (DESIGN.md). CSS-animaties volgen prefers-reduced-motion al; dit is voor JS-animaties. */
export const EASE = 'cubic-bezier(0.22,1,0.36,1)';
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Laat een knop even wippen (+ stop, hartje): klasse eraf, reflow, klasse erop. */
export const pop = (el: HTMLElement) => { if (reduced()) return; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); };
const SUB = { antiek: 'Antiek en brocante', kleding: 'Tweedehands kleding', schroot: 'Sloop en restpartijen', pandjeshuis: 'Pandjeshuis', vlooienmarkt: 'Vlooienmarkt (vaste plek)' };
export const kindLabel = (it: Item) => (it.t === 'm' ? it.kind : it.kind === 'goede-doelen' ? 'Goede-doelenwinkel' : it.kind === 'tweedehands' ? (it.sub ? SUB[it.sub] : 'Tweedehandswinkel') : 'Kringloop');

export function Tile({ it, small }: { it: Item; small?: boolean }) {
  const cls = `tile ${it.t}${isUnsure(it) ? ' unconf' : ''}${it.t === 'm' && it.status === 'cancel' ? ' cancel' : ''}${isTw(it) ? ' tw' : ''}`;
  return <span className={cls} title={kindLabel(it)} style={small ? { width: 24, height: 24 } : undefined}><Ic n={kindIcon(it)} /></span>;
}

export const St = ({ s, pulse }: { s: Status; pulse?: boolean }) => (
  <span className={`st ${s.cls}${pulse && s.open ? ' pulse' : ''}`}><i /><span>{s.txt}</span></span>
);

const CONF = { org: ['org', 'check', 'Bevestigd'], chk: ['chk', 'check', 'Gecontroleerd'], unconf: ['unconf', 'alert', 'Nog niet bevestigd'] } as const;
export function Conf({ it }: { it: Item }) {
  if (it.t !== 'm' || it.status === 'cancel') return null;
  const [cls, icon, txt] = CONF[it.status];
  return <span className={`conf ${cls}`}><Ic n={icon} />{it.status === 'chk' && it.checked ? `Gecontroleerd ${dDay(it.checked)}` : txt}</span>;
}

export const Banner = ({ kind = '', icon, children }: { kind?: string; icon: string; children: ReactNode }) => (
  <div className={`banner ${kind}`}><Ic n={icon} /><span>{children}</span></div>
);
