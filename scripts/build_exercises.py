#!/usr/bin/env python3
"""Genera src/data/exercises.json a partir de free-exercise-db (dominio público).

Uso:  python3 scripts/build_exercises.py ruta/a/exercises.json
Los nombres se traducen con un glosario y reglas de orden (no es traducción
automática neuronal): corrige los casos raros en scripts/overrides_es.json.
"""
import json, re, sys, os

SRC = sys.argv[1] if len(sys.argv) > 1 else "exercises.json"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "src", "data", "exercises.json")

# --- Tipos: E=material (sufijo), M=movimiento (núcleo), B=zona corporal, A=modificador, W=palabra suelta, X=descartar
G = {}
def add(t, pairs):
    for k, v in pairs.items():
        G[k] = (t, v)

add("E", {
 "dumbbell": "con mancuernas", "dumbbells": "con mancuernas",
 "barbell": "con barra", "cable": "en polea", "cables": "en polea",
 "kettlebell": "con kettlebell", "kettlebells": "con kettlebell",
 "smith machine": "en máquina Smith", "machine": "en máquina", "lever": "en máquina", "leverage": "en máquina",
 "band": "con banda elástica", "bands": "con banda elástica", "banded": "con banda elástica",
 "ez bar": "con barra Z", "e z curl bar": "con barra Z", "ez curl bar": "con barra Z", "ez": "con barra Z",
 "medicine ball": "con balón medicinal", "exercise ball": "con fitball", "stability ball": "con fitball",
 "bosu ball": "con Bosu", "foam roller": "con rodillo", "plate": "con disco", "plates": "con discos",
 "rope": "con cuerda", "sled": "con trineo", "chains": "con cadenas", "chain": "con cadenas",
 "trap bar": "con barra hexagonal", "hex bar": "con barra hexagonal", "axle": "con barra gruesa",
 "log": "con tronco", "suspended": "en suspensión", "swiss ball": "con fitball", "pulley": "en polea",
})
add("M", {
 "bench press": "press de banca", "press": "press", "presses": "press",
 "military press": "press militar", "shoulder press": "press de hombros", "arnold press": "press Arnold",
 "overhead press": "press por encima de la cabeza", "french press": "press francés", "floor press": "press en suelo",
 "push press": "push press", "leg press": "prensa de piernas", "see saw press": "press alterno lateral",
 "pull up": "dominadas", "pull ups": "dominadas", "pullup": "dominadas", "chin up": "dominadas supinas",
 "chin ups": "dominadas supinas", "chins": "dominadas supinas",
 "push up": "flexiones", "push ups": "flexiones", "pushups": "flexiones", "pushup": "flexiones",
 "sit up": "abdominales", "sit ups": "abdominales", "crunch": "crunch", "crunches": "crunch",
 "lat pulldown": "jalón al pecho", "pulldown": "jalón", "pulldowns": "jalón", "pushdown": "extensión en polea (pushdown)",
 "deadlift": "peso muerto", "romanian deadlift": "peso muerto rumano", "stiff legged deadlift": "peso muerto con piernas rígidas",
 "sumo deadlift": "peso muerto sumo", "squat": "sentadilla", "squats": "sentadillas", "front squat": "sentadilla frontal",
 "split squat": "sentadilla dividida", "lunge": "zancada", "lunges": "zancadas", "step up": "subida al cajón", "step ups": "subidas al cajón",
 "hip thrust": "elevación de cadera (hip thrust)", "glute bridge": "puente de glúteos", "good morning": "buenos días (good morning)",
 "leg extension": "extensión de cuádriceps", "leg extensions": "extensión de cuádriceps", "leg curl": "curl femoral", "leg curls": "curl femoral",
 "calf raise": "elevación de gemelos", "calf raises": "elevación de gemelos", "calf press": "elevación de gemelos en prensa",
 "curl": "curl", "curls": "curl", "hammer curl": "curl martillo", "hammer curls": "curl martillo",
 "preacher curl": "curl predicador", "preacher curls": "curl predicador", "concentration curl": "curl concentrado", "concentration curls": "curl concentrado",
 "skull crusher": "rompecráneos", "skull crushers": "rompecráneos", "extension": "extensión", "extensions": "extensión",
 "row": "remo", "rows": "remo", "upright row": "remo al mentón", "bent over row": "remo inclinado", "t bar row": "remo en T",
 "face pull": "face pull", "lateral raise": "elevación lateral", "front raise": "elevación frontal", "raise": "elevación", "raises": "elevación",
 "fly": "aperturas", "flye": "aperturas", "flyes": "aperturas", "flys": "aperturas", "crossover": "cruce", "pullover": "pullover",
 "shrug": "encogimientos", "shrugs": "encogimientos", "plank": "plancha", "leg raise": "elevación de piernas", "leg raises": "elevación de piernas",
 "russian twist": "giro ruso", "twist": "giro", "twists": "giros", "mountain climber": "escaladores", "mountain climbers": "escaladores",
 "dip": "fondos", "dips": "fondos", "kickback": "patada", "kickbacks": "patada", "clean": "cargada", "snatch": "arrancada", "jerk": "envión",
 "swing": "swing", "swings": "swings", "jump": "salto", "jumps": "saltos", "hop": "salto", "hops": "saltos", "sprint": "sprint", "sprints": "sprints",
 "walk": "caminata", "walking": "caminata", "stretch": "estiramiento", "stretches": "estiramientos", "smr": "liberación miofascial",
 "rollout": "rueda abdominal", "windmill": "molino de viento", "windmills": "molinos de viento", "lift": "levantamiento", "carry": "transporte",
 "throw": "lanzamiento", "toss": "lanzamiento", "slam": "golpeo", "thrust": "empuje", "bridge": "puente", "rotation": "rotación", "rotations": "rotaciones",
 "circles": "círculos", "pull": "tirón", "pull in": "recogida", "hang": "suspensión", "hyperextension": "hiperextensión", "hyperextensions": "hiperextensiones",
 "drag": "arrastre", "crawl": "arrastre", "drill": "ejercicio", "pass": "pase", "flexion": "flexión", "bend": "inclinación", "bends": "inclinaciones",
 "kick": "patada", "touchers": "toques", "press up": "flexión", "reverse crunch": "crunch inverso", "pec deck": "aperturas en contractor",
 "cleans": "cargadas", "snatches": "arrancadas", "jerks": "envíos", "rowing": "remo", "bicycling": "ciclismo", "jogging": "trote", "running": "carrera",
})
add("B", {
 "triceps": "tríceps", "tricep": "tríceps", "biceps": "bíceps", "bicep": "bíceps", "chest": "pecho", "shoulder": "hombros", "shoulders": "hombros",
 "calf": "gemelos", "calves": "gemelos", "leg": "piernas", "legs": "piernas", "hip": "cadera", "hips": "cadera", "quad": "cuádriceps", "quads": "cuádriceps",
 "hamstring": "isquiotibiales", "hamstrings": "isquiotibiales", "ham": "isquiotibiales", "glute": "glúteos", "glutes": "glúteos", "lat": "dorsal", "lats": "dorsales",
 "back": "espalda", "neck": "cuello", "wrist": "muñeca", "wrists": "muñecas", "ankle": "tobillo", "ab": "abdomen", "abs": "abdomen", "abdominal": "abdomen",
 "forearm": "antebrazo", "forearms": "antebrazos", "delt": "deltoides", "deltoid": "deltoides", "rear delt": "deltoides posterior", "trap": "trapecio", "traps": "trapecio",
 "groin": "ingle", "adductor": "aductores", "adductors": "aductores", "abductor": "abductores", "abductors": "abductores", "oblique": "oblicuos", "obliques": "oblicuos",
 "piriformis": "piriforme", "tibialis": "tibial", "anterior tibialis": "tibial anterior", "brachialis": "braquial", "hip flexor": "flexores de cadera", "flexor": "flexores",
 "upper back": "espalda alta", "lower back": "zona lumbar", "knee": "rodilla", "knees": "rodillas", "arm": "brazo", "arms": "brazos", "head": "cabeza", "heel": "talón",
 "soleus": "sóleo", "achilles": "Aquiles", "iliotibial": "banda iliotibial", "it band": "banda iliotibial", "psoas": "psoas", "rhomboid": "romboides", "levator scapulae": "elevador de la escápula",
 "pectoral": "pectoral", "pecs": "pectoral", "core": "core", "torso": "torso", "spine": "columna", "hamstring": "isquiotibiales",
})
add("A", {
 "incline": "inclinado", "decline": "declinado", "seated": "sentado", "standing": "de pie", "lying": "tumbado", "reverse": "inverso", "reversed": "inverso",
 "alternate": "alterno", "alternating": "alterno", "single": "unilateral", "one arm": "a un brazo", "one handed": "a una mano", "one leg": "a una pierna", "one legged": "a una pierna",
 "single arm": "a un brazo", "single leg": "a una pierna", "two arm": "a dos brazos", "two arms": "a dos brazos", "wide grip": "agarre ancho", "close grip": "agarre cerrado", "narrow grip": "agarre estrecho",
 "medium grip": "agarre medio", "reverse grip": "agarre supino", "underhand": "agarre supino", "overhand": "agarre prono", "palms up": "palmas arriba", "palms down": "palmas abajo", "palm in": "palma hacia dentro",
 "palms in": "palmas hacia dentro", "wide": "ancho", "close": "cerrado", "narrow": "estrecho", "bent": "inclinado", "bent over": "inclinado", "overhead": "sobre la cabeza", "front": "frontal",
 "rear": "posterior", "side": "lateral", "lateral": "lateral", "high": "alto", "low": "bajo", "flat": "plano", "straight": "recto", "weighted": "con lastre", "assisted": "asistido", "kneeling": "de rodillas",
 "prone": "boca abajo", "supine": "boca arriba", "elevated": "elevado", "isometric": "isométrico", "dynamic": "dinámico", "double": "doble", "full": "completo", "half": "medio", "partial": "parcial",
 "lower": "bajo", "upper": "alto", "behind the back": "tras la espalda", "behind the neck": "tras la nuca", "behind": "por detrás", "to the front": "al frente", "wall": "en pared", "hanging": "colgado",
 "stiff": "rígido", "sumo": "sumo", "pronated": "prono", "external": "externa", "internal": "interna", "long": "largo", "short": "corto", "power": "explosivo", "hack": "hack", "off": "desde", "bodyweight": "con peso corporal",
 "slow": "lento", "quick": "rápido", "speed": "de velocidad", "stance": "postura", "lunging": "en zancada", "jumping": "con salto", "twisting": "con giro", "crossbody": "cruzado", "cross body": "cruzado",
 "two": "dos", "three": "tres", "four": "cuatro", "one": "uno", "x": "x",
})
add("X", {"the": "", "a": "", "an": "", "of": "", "with": "", "on": "", "your": "", "and": "", "in": "", "to": "", "from": "", "at": "", "for": "", "using": "", "against": ""})
# Frases/nombres propios con traducción directa (se tratan como núcleo completo)
add("M", {
 "burpee": "burpee", "burpees": "burpees", "bear crawl": "arrastre de oso", "farmer's walk": "paseo del granjero", "farmers walk": "paseo del granjero",
 "turkish get up": "levantamiento turco", "bird dog": "bird dog", "dead bug": "bicho muerto", "superman": "superman", "jackknife": "navaja", "pistol squat": "sentadilla a una pierna (pistol)",
 "box jump": "salto al cajón", "depth jump": "salto en profundidad", "jumping jack": "jumping jacks", "wood chop": "leñador", "woodchop": "leñador", "medicine ball slam": "golpeo de balón medicinal",
 "tire flip": "volteo de neumático", "yoke walk": "paseo con yugo", "zercher squat": "sentadilla Zercher", "zercher squats": "sentadillas Zercher", "bulgarian split squat": "sentadilla búlgara",
 "hang clean": "cargada colgada", "power clean": "cargada de potencia", "power snatch": "arrancada de potencia", "clean and jerk": "dos tiempos", "clean and press": "cargada y press",
 "hyperextensions": "hiperextensiones", "back extension": "extensión lumbar", "reverse fly": "aperturas inversas", "reverse flyes": "aperturas inversas",
 "wrist curl": "curl de muñeca", "wrist curls": "curl de muñeca", "reverse curl": "curl inverso", "reverse curls": "curl inverso", "zottman curl": "curl Zottman", "spider curl": "curl araña",
 "cable crossover": "cruce de poleas", "high pulley": "polea alta", "low pulley": "polea baja", "seated row": "remo sentado", "seated cable row": "remo sentado en polea",
 "triceps extension": "extensión de tríceps", "triceps pushdown": "extensión de tríceps en polea", "tricep pushdown": "extensión de tríceps en polea", "triceps dips": "fondos de tríceps", "bench dip": "fondos en banco",
 "bench dips": "fondos en banco", "hip abduction": "abducción de cadera", "hip adduction": "aducción de cadera", "hip flexion": "flexión de cadera", "hip extension": "extensión de cadera",
 "side bend": "inclinación lateral", "side bends": "inclinaciones laterales", "lateral bend": "inclinación lateral", "cable crunch": "crunch en polea",
})
add("W", {"lying": "tumbado", "front": "frontal"})
for k in ("lying", "front"):
    G[k] = ("A", G[k][1])


# --- Ampliación del glosario (segunda pasada)
add("E", {
 "high pulley": "en polea alta", "low pulley": "en polea baja", "db": "con mancuernas", "landmine": "con landmine",
 "smith": "en máquina Smith", "treadmill": "en cinta", "roller": "con rodillo", "ball": "con balón", "harness": "con arnés",
 "physioball": "con fitball", "sandbag": "con saco de arena", "towel": "con toalla", "straps": "con correas", "ring": "en anillas", "rings": "en anillas",
})
add("M", {
 "walking lunge": "zancada caminando", "walking lunges": "zancada caminando", "push": "empuje", "butt kick": "talones al glúteo", "butt kicks": "talones al glúteo",
 "muscle up": "muscle-up", "bound": "salto", "step": "paso", "pelvic tilt": "inclinación pélvica", "skullcrusher": "rompecráneos", "wheel": "rueda abdominal",
 "sissy squat": "sentadilla sissy", "skating": "patinaje", "skipping": "skipping", "shuffle": "desplazamiento lateral", "thruster": "thruster",
 "goblet squat": "sentadilla goblet", "climb": "trepa", "stairs": "escaleras", "scissor": "tijeras", "scissors": "tijeras", "squeeze": "contracción", "squeezes": "contracciones",
 "touches": "toques", "wipers": "limpiaparabrisas", "tuck": "encogimiento", "tucks": "encogimientos", "return": "retorno",
})
add("B", {
 "chin": "mentón", "quadriceps": "cuádriceps", "elbow": "codo", "elbows": "codos", "hand": "mano", "hands": "manos", "feet": "pies", "foot": "pie", "thigh": "muslo",
 "toe": "puntera", "peroneals": "peroneos", "stomach": "abdomen", "latissimus dorsi": "dorsal ancho", "gastrocnemius": "gemelos", "sternum": "esternón", "finger": "dedos",
 "palm": "palma", "spinal": "columna", "pelvic": "pelvis",
})
add("A", {
 "hammer grip": "agarre neutro", "hammer": "martillo", "grip": "agarre", "inner": "interno", "bent arm": "con brazo flexionado", "box": "en cajón", "up": "arriba",
 "over": "sobre", "split": "dividido", "balance": "de equilibrio", "linear": "lineal", "body": "corporal", "chair": "en silla", "blocks": "desde bloques", "floor": "en suelo",
 "backward": "hacia atrás", "cross": "cruzado", "resistance": "con resistencia", "rack": "en rack", "stationary": "estática", "mid": "medio", "extended": "extendido",
 "deficit": "con déficit", "intermediate": "intermedio", "inverted": "invertido", "parallel": "paralelo", "middle": "medio", "advanced": "avanzado", "diagonal": "diagonal",
 "goblet": "goblet", "pin": "en pines", "pins": "en pines", "plyo": "pliométrico", "heavy": "pesado", "scapular": "escapular", "vertical": "vertical", "upright": "vertical",
 "forward": "hacia delante", "downward": "hacia abajo", "upward": "hacia arriba", "upper body": "de la parte superior del cuerpo", "lower body": "de la parte inferior del cuerpo",
 "bench": "en banco", "neutral": "neutro", "mixed": "mixto", "round": "redondeado", "legged": "con piernas", "cambered": "con barra curva", "atlas": "Atlas", "nordic": "nórdico",
 "trail": "en sendero", "release": "liberación", "start": "inicial", "stride": "en zancada", "toe": "puntera", "iso": "isométrico",
})
add("E", {"v bar": "con barra en V"})
add("A", {"neutral grip": "agarre neutro", "close triceps position": "agarre cerrado"})
add("X", {"exercise": "", "attachment": "", "handle": "", "version": "", "range": "", "through": "", "below": "", "position": "", "style": "", "or": "", "into": "", "between": "", "above": "", "para": "", "part": "", "all": ""})
for k, v in (("lying", "tumbado"), ("front", "frontal")):
    G[k] = ("A", v)
G.pop("bicycling", None)

def load_overrides():
    p = os.path.join(HERE, "overrides_es.json")
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {}

def tokenize(name):
    s = name.lower()
    s = s.replace("’", "'").replace("e-z", "ez")
    s = re.sub(r"\(([^)]*)\)", r" \1 ", s)
    s = re.sub(r"[-/,&]", " ", s)
    s = re.sub(r"[^a-z0-9' ]", " ", s)
    s = s.replace("'s", "s")
    return [t for t in s.split() if t]

def translate(name, equipment, cat):
    toks = tokenize(name)
    out, i = [], 0
    while i < len(toks):
        hit = None
        for n in (4, 3, 2, 1):
            key = " ".join(toks[i:i + n])
            if len(toks[i:i + n]) == n and key in G:
                hit = (G[key], n); break
        if not hit and toks[i].endswith("s") and toks[i][:-1] in G:
            hit = (G[toks[i][:-1]], 1)
        if hit:
            (t, es), n = hit; out.append((t, es)); i += n
        else:
            out.append(("R", toks[i])); i += 1
    equips = [es for t, es in out if t == "E"]
    equip = equips[0] if equips else None
    rest = [(t, es) for t, es in out if t not in ("E", "X")]
    # si el nombre no trae material, lo añadimos desde el campo equipment
    if not equip:
        equip = {"dumbbell": "con mancuernas", "barbell": "con barra", "cable": "en polea", "kettlebells": "con kettlebell",
                 "machine": "en máquina", "bands": "con banda elástica", "medicine ball": "con balón medicinal",
                 "exercise ball": "con fitball", "e-z curl bar": "con barra Z", "foam roll": "con rodillo"}.get(equipment)
        if cat in ("cardio",): equip = None
    h = next((k for k, (t, _) in enumerate(rest) if t == "M"), None)
    if h is None:
        rb = [es for t, es in rest if t == "B"]
        ro = [es for t, es in rest if t != "B"]
        body = " ".join(([" y ".join(rb)] if rb else []) + ro)
    else:
        before, head, after = rest[:h], rest[h][1], rest[h + 1:]
        bparts = [es for t, es in before if t == "B"]
        others = [es for t, es in before if t != "B"]
        comp = " de " + " y ".join(bparts) if bparts else ""
        # si ya hay 'de' en el núcleo (p. ej. 'extensión de tríceps') no duplicamos
        if bparts and " de " in head: comp = " " + " ".join(bparts)
        tail = [es for _, es in after]
        body = " ".join([head + comp] + others + tail)
    body = re.sub(r"\s+", " ", body).strip()
    # elimina palabras repetidas consecutivas ("lateral lateral")
    w = body.split(" "); body = " ".join(x for k, x in enumerate(w) if k == 0 or x.lower() != w[k - 1].lower())
    noun = equip.split(" ")[-1] if equip else ""
    if equip and noun not in body.lower():
        body += " " + equip
    return body[:1].upper() + body[1:]

def main():
    data = json.load(open(SRC, encoding="utf-8"))
    ov = load_overrides()
    rows = []
    for x in data:
        eq = x.get("equipment") or "body only"
        n_es = ov.get(x["id"]) or ov.get(x["name"]) or translate(x["name"], x.get("equipment"), x["category"])
        rows.append({
            "i": x["id"], "n": n_es, "e": x["name"],
            "p": x["primaryMuscles"], "s": x.get("secondaryMuscles", []),
            "q": eq, "l": x.get("level") or "beginner", "c": x["category"],
            "t": x.get("instructions", []), "m": len(x.get("images", [])),
        })
    rows.sort(key=lambda r: r["n"].lower())
    json.dump(rows, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(len(rows), "ejercicios ->", os.path.relpath(OUT))
    if "--dump" in sys.argv:
        for r in rows: print(f'{r["i"]}\t{r["e"]}\t=>\t{r["n"]}')

if __name__ == "__main__":
    main()
