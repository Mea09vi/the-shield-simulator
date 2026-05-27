/* ────────────────────────────────────────────────────────────────────────
   THE SHIELD 2.0 — UDC Simulator v13 · Static IALA Seamark Data
   ────────────────────────────────────────────────────────────────────────
   ที่มา        : Overpass API (overpass-api.de) — snapshot 2026-05-27
   bbox        : 12.3,100.5,13.0,101.2 (อ่าวสัตหีบ + เกาะคราม + Map Ta Phut)
   licence     : ODbL · © OpenStreetMap contributors
   ใช้กรณีไหน  : เมื่อ Overpass API ถูก CORS-block (เปิดผ่าน file://)
                 หรือ network outage → MDA.Seamarks จะ fall back มาที่นี่
   อัปเดต      : Re-fetch จาก Overpass แล้ว overwrite ไฟล์นี้ได้เลย
   ──────────────────────────────────────────────────────────────────────── */
window.MDA_SEAMARK_STATIC = {
    "version": 0.6,
    "generator": "Overpass API (snapshot)",
    "elements": [
        {"type":"node","id":1293081706,"lat":12.6754777,"lon":101.1429862,"tags":{"seamark:light:character":"Iso","seamark:light:colour":"green","seamark:light:period":"6","seamark:light:range":"7","seamark:name":"Map Ta Phut","seamark:type":"light_minor"}},
        {"type":"node","id":1293081714,"lat":12.6894825,"lon":101.1392432,"tags":{"seamark:light:character":"Q","seamark:light:colour":"green","seamark:light:range":"8","seamark:type":"light_minor"}},
        {"type":"node","id":1293081717,"lat":12.6469311,"lon":101.1478730,"tags":{"seamark:light:character":"Fl","seamark:light:colour":"white","seamark:light:period":"4","seamark:light:range":"8","seamark:type":"light_minor"}},
        {"type":"node","id":1293081719,"lat":12.7240815,"lon":101.0290155,"tags":{"seamark:light:character":"F","seamark:light:colour":"red","seamark:light:range":"10","seamark:type":"light_minor"}},
        {"type":"node","id":1293081726,"lat":12.6819632,"lon":100.9983568,"tags":{"seamark:light:1:colour":"white","seamark:light:2:colour":"green","seamark:type":"light_minor"}},
        {"type":"node","id":1293081728,"lat":12.5951736,"lon":100.9656174,"tags":{"seamark:light:character":"Fl","seamark:light:colour":"white","seamark:light:period":"3","seamark:light:range":"8","seamark:name":"Hin Chula","seamark:type":"light_minor"}},
        {"type":"node","id":1293081740,"lat":12.6036656,"lon":100.9169674,"tags":{"seamark:light:character":"Fl","seamark:light:colour":"white","seamark:light:period":"10","seamark:light:range":"15","seamark:name":"Ko Chorake","seamark:type":"light_major"}},
        {"type":"node","id":1293081742,"lat":12.6165490,"lon":100.9094565,"tags":{"seamark:light:character":"Fl","seamark:light:colour":"white","seamark:light:period":"5","seamark:light:range":"10","seamark:name":"Ao Sattahip","seamark:type":"light_minor"}},
        {"type":"node","id":1293081750,"lat":12.6181093,"lon":100.9136651,"tags":{"seamark:light:character":"Fl","seamark:light:colour":"white","seamark:light:period":"4","seamark:light:range":"6","seamark:type":"light_minor"}},
        {"type":"node","id":1293081765,"lat":12.6266813,"lon":100.9151165,"tags":{"seamark:light:character":"Iso","seamark:light:colour":"yellow","seamark:light:period":"4","seamark:light:range":"8","seamark:type":"light_minor"}},
        {"type":"node","id":1293081771,"lat":12.6444235,"lon":100.8575471,"tags":{"seamark:light:character":"Fl","seamark:light:colour":"white","seamark:light:period":"6","seamark:light:range":"10","seamark:name":"Ko Tao Mo","seamark:type":"light_minor"}},
        {"type":"node","id":1293081778,"lat":12.6822136,"lon":100.8261552,"tags":{"seamark:light:character":"Fl","seamark:light:colour":"white","seamark:light:period":"5","seamark:light:range":"5","seamark:name":"Hin Khi Sua","seamark:type":"light_minor"}},
        {"type":"node","id":1293081786,"lat":12.7950617,"lon":100.7967807,"tags":{"seamark:light:character":"Fl","seamark:light:colour":"white","seamark:light:period":"3","seamark:light:range":"9","seamark:name":"Hin Rang Kwian","seamark:type":"light_minor"}},
        {"type":"node","id":1293081789,"lat":12.9463248,"lon":100.8584119,"tags":{"seamark:light:1:character":"Fl","seamark:light:1:colour":"red","seamark:light:1:period":"10","seamark:light:1:range":"8","seamark:name":"Ko Chun","seamark:type":"light_minor"}},
        {"type":"node","id":1293081798,"lat":12.9322182,"lon":100.6705619,"tags":{"seamark:light:character":"Fl","seamark:light:colour":"white","seamark:light:period":"5","seamark:light:range":"31","seamark:name":"Ko Phai","seamark:type":"light_major"}},
        {"type":"node","id":1603728988,"lat":12.9500109,"lon":100.7988905,"tags":{"historic":"wreck","name":"HTMS Kut","seamark:type":"wreck"}},
        {"type":"node","id":10938593326,"lat":12.6286222,"lon":101.1611639,"tags":{"seamark:buoy_special_purpose:colour":"yellow","seamark:buoy_special_purpose:shape":"pillar","seamark:light:character":"Fl","seamark:light:colour":"yellow","seamark:light:period":"6","seamark:light:range":"6","seamark:type":"buoy_special_purpose"}},
        {"type":"node","id":10938593327,"lat":12.6334278,"lon":101.1598806,"tags":{"seamark:buoy_special_purpose:colour":"yellow","seamark:light:character":"Fl","seamark:light:colour":"yellow","seamark:type":"buoy_special_purpose"}},
        {"type":"node","id":10938593328,"lat":12.6383917,"lon":101.1596056,"tags":{"seamark:buoy_special_purpose:colour":"yellow","seamark:light:character":"Fl","seamark:light:colour":"yellow","seamark:type":"buoy_special_purpose"}},
        {"type":"node","id":11088901693,"lat":12.5854693,"lon":100.9545277,"tags":{"historic":"wreck","seamark:type":"wreck","seamark:wreck:category":"non-dangerous"}},
        {"type":"node","id":2498822586,"lat":12.6402738,"lon":101.1564342,"tags":{"seamark:crane:category":"sheerlegs","seamark:type":"crane"}},
        {"type":"node","id":2498822629,"lat":12.6420538,"lon":101.1564919,"tags":{"seamark:crane:category":"sheerlegs","seamark:type":"crane"}},
        {"type":"node","id":2497943480,"lat":12.8264464,"lon":100.9058389,"tags":{"seamark:mooring:category":"dolphin","seamark:type":"mooring"}},
        {"type":"node","id":2497943502,"lat":12.8269115,"lon":100.9071916,"tags":{"seamark:mooring:category":"dolphin","seamark:type":"mooring"}},
        {"type":"node","id":2497943562,"lat":12.8276439,"lon":100.9043021,"tags":{"seamark:mooring:category":"dolphin","seamark:type":"mooring"}},
        {"type":"node","id":2497943630,"lat":12.8280174,"lon":100.9048090,"tags":{"seamark:mooring:category":"dolphin","seamark:type":"mooring"}},
        {"type":"node","id":2497943672,"lat":12.8282042,"lon":100.9053707,"tags":{"seamark:mooring:category":"dolphin","seamark:type":"mooring"}},
        {"type":"node","id":2497943737,"lat":12.8285960,"lon":100.9062589,"tags":{"seamark:mooring:category":"dolphin","seamark:type":"mooring"}},
        {"type":"node","id":2497943828,"lat":12.8291404,"lon":100.9078700,"tags":{"seamark:mooring:category":"dolphin","seamark:type":"mooring"}},
        {"type":"node","id":11158760540,"lat":12.9304046,"lon":100.8637587,"tags":{"seamark:type":"mooring"}},
        {"type":"node","id":11158760543,"lat":12.9307510,"lon":100.8643950,"tags":{"seamark:type":"mooring"}},
        {"type":"node","id":11158760553,"lat":12.9300344,"lon":100.8645330,"tags":{"seamark:type":"mooring"}},
        {"type":"node","id":11158760558,"lat":12.9292255,"lon":100.8648119,"tags":{"seamark:type":"mooring"}},
        {"type":"node","id":11158760564,"lat":12.9288313,"lon":100.8654498,"tags":{"seamark:type":"mooring"}},
        {"type":"node","id":11158760571,"lat":12.9284285,"lon":100.8654851,"tags":{"seamark:type":"mooring"}}
    ]
};
console.log('[MDA·Seamarks] static data loaded:', window.MDA_SEAMARK_STATIC.elements.length, 'nodes');
