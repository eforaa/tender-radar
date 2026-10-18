/** Responsive reading layer shared by the server-rendered pages. */
export const RADAR_STYLES = `
:root[data-theme="light"]{--paper:#f4f6f5;--surface:#fff;--surface-2:#edf3f0;--ink:#162d28;--ink-soft:#4d625b;--ink-faint:#5c7069;--line:#d6e1dc;--line-soft:#e7eeea;--accent:#08745b;--accent-bg:#e0f2e9;--alarm:#b53f32;--alarm-bg:#fceeea}
:root:not([data-theme="light"]){--accent:#77dbc1;--accent-bg:#163d36}
body{font-size:16px;line-height:1.6}
.wrap{max-width:78rem}
.top .inner{max-width:78rem}
.top{box-shadow:0 1px 0 var(--line-soft)}
.top .nav a,.theme-btn,.burger{min-height:44px;align-items:center}
.top .nav a{display:inline-flex;border-radius:8px}
.theme-btn,.burger{min-width:44px}
.burger span{width:100%}
a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid var(--accent);outline-offset:4px}
.radar-hero{display:grid;grid-template-columns:1.7fr 1fr;gap:3rem;align-items:center;padding:1.5rem 0 2rem}
.eyebrow{font-size:.7rem;font-weight:700;letter-spacing:.12em;color:var(--accent);margin:0 0 1rem}
.radar-hero h1{font-size:clamp(2rem,3.8vw,3.35rem);line-height:1.12;letter-spacing:-.045em;margin:0 0 1.25rem;font-weight:700}
.radar-hero h1 span{color:var(--accent)}
.hero-description{max-width:39rem;color:var(--ink-soft);font-size:1rem;margin:0}
.hero-guide{padding:1.5rem 1.75rem;border-left:2px solid var(--line);color:var(--ink-soft);font-size:.9rem}
.hero-guide ol{padding-left:1.3rem;margin:.75rem 0 1rem}.hero-guide li{padding:.25rem 0}.hero-guide a{font-weight:600}
.scope-nav{display:flex;gap:.4rem;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:.75rem}
.scope-nav a{display:inline-flex;align-items:center;min-height:44px;padding:.5rem 1.25rem;border:1px solid transparent;border-radius:8px;color:var(--ink-soft);text-decoration:none;font-weight:600}
.scope-nav a:hover{background:var(--surface-2)}.scope-nav a[aria-current]{background:var(--ink);color:var(--paper)}
.scope-caption{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.5rem;padding:1rem 0;font-size:.8rem;color:var(--ink-soft)}
.scope-caption a{color:var(--ink-soft)}
.radar-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1rem;margin-bottom:2.5rem}
.radar-metrics>div{display:flex;flex-direction:column;gap:.4rem;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:1.15rem;min-width:0}
.radar-metrics span{font-size:.8rem;color:var(--ink-soft)}
.radar-metrics strong{font-size:clamp(1.4rem,2.1vw,1.9rem);letter-spacing:-.04em;line-height:1.4;font-variant-numeric:tabular-nums}
.radar-metrics em{font-style:normal;font-size:.85rem;color:var(--ink-soft);letter-spacing:0}
.radar-metrics small{font-size:.72rem;color:var(--ink-faint)}
.results-heading{display:flex;align-items:baseline;justify-content:space-between;gap:1rem;margin-bottom:1rem}.results-heading h2{margin:0;font-size:1.4rem;border:0;padding:0}.results-heading>span{font-size:.8rem;color:var(--ink-soft)}
.control-panel{border:1px solid var(--line);border-radius:12px;padding:1.1rem;background:var(--surface);margin-bottom:1.25rem}
.control-panel .sortbar{border:0;background:none;padding:0;box-shadow:none;gap:.75rem;align-items:flex-end;margin-bottom:1rem}
.control-panel .sortbar input[type=search]{min-height:48px;font-size:16px;background:var(--paper);border:1px solid var(--line);padding:.7rem .9rem;flex:1 1 19rem}
.control-panel .sortbar label{display:flex;flex-direction:column;align-items:stretch;gap:.25rem;font-size:.75rem;color:var(--ink-soft)}
.control-panel .sortbar select{min-height:48px;font-size:.85rem;max-width:14rem;padding:.5rem}
.control-panel .go{min-height:48px;background:var(--accent);color:var(--paper);border:0;font-weight:700}
.control-panel .presets{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem}
.control-panel .preset{min-height:44px;font-size:.82rem;padding:.5rem .9rem;border-radius:8px;white-space:normal;line-height:1.4;display:inline-flex;align-items:center}
.control-panel .filters{margin:0}.control-panel .filters-more{margin:0;border:0;background:none;box-shadow:none}.control-panel .filters-more summary{padding:.65rem 0;min-height:44px;font-size:.85rem}
.control-panel .filter-row{gap:.75rem}.control-panel .filter-row select{max-width:100%;min-width:0}.control-panel input,.control-panel select,.control-panel button{min-height:44px}
.rows{border:0;background:none;display:grid;gap:.8rem;box-shadow:none}
.row{border:1px solid var(--line)!important;border-radius:12px;padding:1.2rem;gap:.5rem 1rem;box-shadow:0 2px 4px #00000003}
.row:hover{border-color:var(--accent)!important;background:var(--surface)}
.row .who{min-width:0}.row .name{font-size:1rem;line-height:1.5}.row .meta{font-size:.8rem;line-height:1.6;color:var(--ink-soft)}
.row .amount .big{font-size:1.2rem}.row .amount .exact{font-size:.7rem;overflow-wrap:anywhere}
.row .flags{padding-top:.4rem}.row .flag{font-size:.74rem;line-height:1.5;white-space:normal}
.row .row-status{font-size:.72rem;color:var(--accent);font-weight:600;margin-bottom:.3rem}.row .coverage-note{font-size:.75rem;color:var(--ink-soft);margin-top:.3rem}
.row .star{min-width:44px;min-height:44px;display:inline-flex;justify-content:center;align-items:center}
@media(max-width:60rem){.radar-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.hero-guide{padding:1rem}.radar-hero{gap:1.5rem}.results-heading{align-items:flex-start;flex-direction:column;gap:.25rem}}
@media(max-width:44rem){
 .wrap{padding-top:1.25rem}.radar-hero{display:block;padding:0 0 1.5rem}.radar-hero h1{font-size:2.25rem}.radar-hero .eyebrow{font-size:.6rem;letter-spacing:.08em;margin-bottom:.8rem}.hero-description{font-size:.9rem}.hero-guide{display:none}
 .scope-nav{gap:.25rem;display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}.scope-nav a{padding:.5rem .25rem;justify-content:center;font-size:.78rem}
 .scope-caption{font-size:.73rem}.radar-metrics{gap:.5rem;margin-bottom:1.5rem}.radar-metrics>div{padding:.8rem}.radar-metrics span{font-size:.7rem;min-height:2.2em}.radar-metrics strong{font-size:1.4rem}.radar-metrics small{font-size:.68rem}.radar-metrics em{display:block;font-size:.7rem}
 .control-panel{padding:1rem}
 .control-panel .sortbar{display:flex;flex-direction:column;align-items:stretch;gap:1rem}
 .control-panel .sortbar input[type=search]{flex:none;width:100%;min-width:0;height:48px}
 .control-panel .sortbar label{order:initial;display:flex;flex-direction:column;align-items:stretch;gap:.4rem;width:100%;min-width:0;font-size:.85rem}
 .control-panel .sortbar select{max-width:none;width:100%;min-width:0;height:48px;font-size:16px;padding:.5rem .75rem}
 .control-panel .sortbar .go{order:initial;width:100%;height:48px;padding:.5rem 1rem}
 .control-panel .presets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.5rem;overflow:visible;margin-top:1rem;padding-top:1rem;border-top:1px solid var(--line)}
 .control-panel .preset{width:100%;min-width:0;min-height:52px;padding:.5rem;font-size:.8rem;text-align:center;justify-content:center;white-space:normal;line-height:1.35}
 .control-panel .preset:first-child{grid-column:1 / -1}
 .control-panel .filters-more summary{display:flex;align-items:center;gap:.5rem;width:100%;padding:.75rem;border:1px solid var(--line);border-radius:8px;min-height:48px}
 .control-panel .filter-actions{align-items:stretch;flex-direction:column}.control-panel .filter-actions button{width:100%}

 .control-panel .filters-more .inner{padding:.5rem 0}.control-panel .filter-row{display:flex;flex-direction:column;align-items:stretch}.control-panel .filter-row input,.control-panel .filter-row select{width:100%;min-width:0;font-size:16px}.control-panel .check{white-space:normal}
 .rows{margin-inline:0;gap:.75rem}.row{padding:1rem;display:flex;gap:.4rem}.row .dot{display:none}.row .amount{order:0;display:flex;flex-wrap:wrap;gap:.25rem 1rem;width:100%;justify-content:space-between}.row .amount .exact{display:block;font-size:.65rem}.row .who{order:-1;width:100%}.row .name a{display:block;-webkit-line-clamp:unset;overflow:visible}.row .name a::after{display:none}.row .meta{white-space:normal;overflow:visible}.row .signal{white-space:normal;overflow:visible;font-size:.8rem;width:100%;padding-top:.5rem;border-top:1px solid var(--line-soft)}.row .row-status{font-size:.7rem}.row .coverage-note{font-size:.7rem}
 .tabbar a,.tabbar label{font-size:.75rem;color:var(--ink-soft)}
}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition:none!important}}
`;
