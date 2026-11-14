import math
def squircle(cx, cy, r, n=5, pts=360):
    out = []
    for i in range(pts):
        t = 2 * math.pi * i / pts
        c, s = math.cos(t), math.sin(t)
        out.append(f"{cx + r * math.copysign(abs(c) ** (2 / n), c):.1f},{cy + r * math.copysign(abs(s) ** (2 / n), s):.1f}")
    return "M" + " L".join(out) + " Z"
def P(a, r, cx, cy): return (cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a)))
def arc(a0, a1, r, cx, cy):
    s, e = P(a0, r, cx, cy), P(a1, r, cx, cy)
    return f"M{s[0]:.1f} {s[1]:.1f} A{r} {r} 0 {1 if (a1 - a0) % 360 > 180 else 0} 1 {e[0]:.1f} {e[1]:.1f}"

LX, LY, LR = 650, 520, 168       # trust lens
MX = 560                          # merge point
NX = 884                          # incident node
ys = [236, 332, 426, 520, 614, 708, 804]
cols = ['#5fb4ff', '#59d7ff', '#7ea8ff', '#ffffff', '#59d7ff', '#7ea8ff', '#5fb4ff']
ribbons, dots = [], []
for i, y0 in enumerate(ys):
    d = f"M126,{y0} C320,{y0} 380,520 {MX},520 L{LX+40},520"
    w = 24 if i != 3 else 28
    op = 0.55 + 0.1 * (3 - abs(i - 3))
    ribbons.append(f'<path d="{d}" stroke="url(#rb{i % 3})" stroke-width="{w}" stroke-opacity="{op:.2f}" fill="none" stroke-linecap="round" style="mix-blend-mode:screen"/>')
    warm = True
    dots.append(f'<circle cx="126" cy="{y0}" r="{[13,16,14,17,14,16,13][i]}" fill="{"#ffb454" if warm else "#cfe6ff"}"/><circle cx="126" cy="{y0}" r="{[25,28,26,29,26,28,25][i]}" fill="none" stroke="{"#ffb454" if warm else "#cfe6ff"}" stroke-opacity=".35" stroke-width="3"/>')
ticks = ""
a0, a1 = -140, 140
for i in range(0, 29):
    a = a0 + (a1 - a0) * i / 28
    major = i % 7 == 0
    p, q = P(a, 218 if major else 221, LX, LY), P(a, 234, LX, LY)
    ticks += f'<path d="M{p[0]:.1f} {p[1]:.1f} L{q[0]:.1f} {q[1]:.1f}" stroke="#fff" stroke-opacity="{0.4 if major else 0.17}" stroke-width="{5 if major else 3}" stroke-linecap="round"/>'
endp = P(a0 + (a1 - a0) * 0.82, 198, LX, LY)

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" role="img" aria-label="DeltaTrace app icon">
<defs>
  <clipPath id="sq"><path d="{squircle(512,512,512)}"/></clipPath>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b2a44"/><stop offset=".5" stop-color="#0b121d"/><stop offset="1" stop-color="#03060a"/></linearGradient>
  <radialGradient id="glowBg" cx="{LX/1024:.3f}" cy=".5" r=".55"><stop offset="0" stop-color="#2f78ff" stop-opacity=".40"/><stop offset=".55" stop-color="#2f78ff" stop-opacity=".08"/><stop offset="1" stop-color="#2f78ff" stop-opacity="0"/></radialGradient>
  <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".14"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <linearGradient id="rb0" gradientUnits="userSpaceOnUse" x1="126" y1="0" x2="{LX+40}" y2="0"><stop offset="0" stop-color="#5fb4ff" stop-opacity=".25"/><stop offset=".6" stop-color="#6cc4ff"/><stop offset="1" stop-color="#e8f6ff"/></linearGradient>
  <linearGradient id="rb1" gradientUnits="userSpaceOnUse" x1="126" y1="0" x2="{LX+40}" y2="0"><stop offset="0" stop-color="#59d7ff" stop-opacity=".25"/><stop offset=".6" stop-color="#5de6ff"/><stop offset="1" stop-color="#f0fdff"/></linearGradient>
  <linearGradient id="rb2" gradientUnits="userSpaceOnUse" x1="126" y1="0" x2="{LX+40}" y2="0"><stop offset="0" stop-color="#7ea8ff" stop-opacity=".25"/><stop offset=".6" stop-color="#82a8ff"/><stop offset="1" stop-color="#eef3ff"/></linearGradient>
  <linearGradient id="band" gradientUnits="userSpaceOnUse" x1="{LX}" y1="0" x2="{NX}" y2="0"><stop offset="0" stop-color="#e8f6ff"/><stop offset="1" stop-color="#ffffff"/></linearGradient>
  <linearGradient id="ringG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9fe0ff"/><stop offset="1" stop-color="#3a7dff"/></linearGradient>
  <linearGradient id="lensRim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".5" stop-color="#bfe0ff" stop-opacity=".25"/><stop offset="1" stop-color="#5da2ff" stop-opacity=".35"/></linearGradient>
  <radialGradient id="lensFill" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".6" stop-color="#9cc8ff" stop-opacity=".07"/><stop offset="1" stop-color="#4c8dff" stop-opacity=".03"/></radialGradient>
  <radialGradient id="nodeG"><stop offset="0" stop-color="#fff"/><stop offset=".4" stop-color="#c8e6ff"/><stop offset="1" stop-color="#4c8dff" stop-opacity="0"/></radialGradient>
  <filter id="b6" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
  <filter id="b18" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="18"/></filter>
  <filter id="b3" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3"/></filter>
</defs>
<g clip-path="url(#sq)">
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect width="1024" height="1024" fill="url(#glowBg)"/>
  <!-- streams: soft glow behind, crisp ribbons in front -->
  <g filter="url(#b18)" opacity=".75">{"".join(ribbons)}</g>
  <g>{"".join(ribbons)}</g>
  <g>{"".join(dots)}</g>
  <!-- trust lens -->
  <circle cx="{LX}" cy="{LY}" r="{LR}" fill="url(#lensFill)"/>
  <circle cx="{LX}" cy="{LY}" r="{LR}" fill="none" stroke="url(#lensRim)" stroke-width="7"/>
  <path d="{arc(-126,-52,LR-16,LX,LY)}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="7" stroke-linecap="round" filter="url(#b3)"/>
  <circle cx="{LX}" cy="{LY}" r="{LR-34}" fill="none" stroke="#fff" stroke-opacity=".10" stroke-width="2"/>
  <path d="{arc(40,140,LR-12,LX,LY)}" fill="none" stroke="#9cc8ff" stroke-opacity=".35" stroke-width="5" stroke-linecap="round"/>
  <!-- merged calm stream and incident node -->
  <path d="M{MX-30},520 H{NX}" stroke="url(#band)" stroke-width="46" stroke-linecap="round" fill="none" filter="url(#b18)" opacity=".8"/>
  <path d="M{MX-30},520 H{NX}" stroke="url(#band)" stroke-width="34" stroke-linecap="round" fill="none"/>
  <circle cx="{NX}" cy="520" r="92" fill="url(#nodeG)" opacity=".9" filter="url(#b6)"/>
  <circle cx="{NX}" cy="520" r="54" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="5"/>
  <circle cx="{NX}" cy="520" r="34" fill="#fff"/>
  <!-- trust gauge around the lens -->
  <path d="{arc(a0,a1,198,LX,LY)}" fill="none" stroke="#fff" stroke-opacity=".09" stroke-width="20" stroke-linecap="round"/>
  <path d="{arc(a0,a0+(a1-a0)*0.82,198,LX,LY)}" fill="none" stroke="url(#ringG)" stroke-width="20" stroke-linecap="round"/>
  {ticks}
  <circle cx="{endp[0]:.1f}" cy="{endp[1]:.1f}" r="17" fill="#fff"/><circle cx="{endp[0]:.1f}" cy="{endp[1]:.1f}" r="8" fill="#2f78ff"/>
  <rect width="1024" height="1024" fill="url(#sheen)"/>
</g>
<path d="{squircle(512,512,509)}" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="3"/>
</svg>'''
open('docs/design/icon-concept.svg', 'w').write(svg)
print('ok')
