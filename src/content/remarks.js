/* ============================================================================
   REMARKS

   What visitors say. Heavily weighted toward the thing in front of them:

     1. the specific object — type, skeleton part, culture, condition, rarity,
        depth, how eerie it is
     2. who is saying it — a child and a scholar do not share a vocabulary
     3. ambient museum chatter (café, feet, parking)

   Placeholders: {culture} {name} {material} {period} {depth} {era} {part}
   ============================================================================ */
(function (S7) {
  "use strict";

  /* ---------- by class ----------------------------------------------------- */

  const BY_KIND = {
    painting: [
      "The colours are still in it. After all that time in the ground.",
      "Look at the edge — you can see where it was cut out of something bigger.",
      "I keep trying to work out what they were looking at when they painted it.",
      "There's a whole world in there and we don't know a single name from it.",
      "Somebody stood in front of this and decided where every mark went.",
      "It's smaller than I expected. They always are.",
      "The frame's worth more than my car.",
      "That green. What is that green?",
      "I like that they didn't fix the crack.",
      "How do you even date the pigment?",
      "The ground layer is still there under the losses. You can read the whole thing.",
      "There's an underdrawing. Look — the hand was somewhere else first.",
      "It's been cut down. The composition continues off both edges.",
      "Four colours. That's the whole palette. Nothing wasted.",
      "I can feel them thinking. That's the bit you can't fake.",
      "The label says {material}. On something that old.",
      "From {depth}. A painting from {depth}.",
      "They painted wet into wet. Finished in one sitting.",
      "Nobody has consolidated this. It's as it came out of the ground.",
      "I keep coming back to this one. I don't know why.",
    ],
    sculpture: [
      "You want to touch it. You're not allowed, but you want to.",
      "Whoever carved this knew exactly where the light was going to fall.",
      "It's the missing bits that get me. Where did the arms go?",
      "It's been looked at by more people in this room than in a thousand years.",
      "Walk round it — it changes completely from the other side.",
      "Imagine the size of the block they started with.",
      "Someone had to carry this up the shaft. All the way.",
      "The tool marks on the back are rougher. Nobody was meant to see that side.",
      "It's got a face like my uncle.",
      "There's still paint in the crevices. It would have been bright.",
      "The base was never finished. It sat in a socket somewhere.",
      "Proportions that careful are a rule, not a guess.",
      "Workshop work. More than one hand on this.",
      "The breaks are old. It went into the ground already like this.",
      "Made of {material}. You can see the grain.",
      "From {depth}. A full figure from that far down.",
      "I want to know who sat for it. If anyone sat for it.",
      "It's monumental. It was meant to stop a room.",
      "The light from the track is doing half the work. Look at the cheek.",
      "I'd queue for this on a Tuesday morning.",
    ],
    object: [
      "Somebody owned this. Used it. Put it down somewhere and never picked it up.",
      "It's the ordinary things that get me, honestly.",
      "That's the same shape we still make. Four thousand years and the same shape.",
      "It's so small. It fitted in a hand.",
      "Whoever lost this was probably furious.",
      "I've got one almost exactly like it in a drawer at home.",
      "The wear on it — you can see which way it was held.",
      "It's not beautiful. It's just true.",
      "A {name}. From {depth}. In a case in a room in a town.",
      "Made of {material}. Still doing its job, sort of.",
      "You can see the maker's decisions in every edge.",
      "This is the sort of thing that never makes the posters. It should.",
      "It's been catalogued more carefully than most of my life.",
      "Someone chose this one. Out of everything. This one.",
      "I keep thinking about the last person who held it.",
      "The ordinary ones are the ones that tell you how people lived.",
      "It's heavier than it looks. Or was, before the ground took half of it.",
      "That's a whole story in something you could put in a pocket.",
    ],
  };

  /* ---------- by specific type --------------------------------------------- */

  const BY_OBJECT = {
    coin: [
      "No wear on it at all. Struck and buried, never spent.",
      "You could still spend that, in the right century.",
      "There's the spiral again. Eight turns. It's on half the things in here.",
      "The portrait is worn flat on one side. Pocket wear.",
      "A whole economy in something the size of a fingernail.",
      "I wonder who they were paying.",
    ],
    blade: [
      "Still an edge on it. After all this time.",
      "The rivet holes are drilled, not punched. That's precision.",
      "They sharpened this so many times the shape changed.",
      "It's a working knife, not a ceremony. Look at the polish on the grip end.",
      "Someone trusted their life to that edge.",
    ],
    lamp: [
      "It's still got fuel in it. It was never lit.",
      "Someone filled that lamp, set it down in the dark, and walked away.",
      "No soot at the spout. Not once.",
      "The whole room would have lived by that little flame.",
      "I can smell the oil. I know I can't. But I can.",
    ],
    watch: [
      "That's — hang on. What's the label say? Read the label again.",
      "That can't be right. Look at the depth on the card.",
      "My grandad had one like that.",
      "A wristwatch. From {depth}. I'm going to sit down.",
      "The strap's perished. The mechanism is perfect. That can't be right.",
    ],
    marker: [
      "That's the same pattern the survey office still uses.",
      "There's a number stamped on the cap. Does anyone know what it means?",
      "I don't like that one. I don't know why.",
      "That's our institute's mark. On something from the bottom of the shaft.",
      "I'm going to pretend I didn't read the label.",
    ],
    console: [
      "Oh my god, I had one of those.",
      "The cartridge is still in it!",
      "Two hundred years from now that's what they'll dig up of us.",
      "I know that click. I can hear that click.",
      "That's my childhood in a display case. Rude.",
    ],
    bonefrag: [
      "Is that — is that a person?",
      "The card says probably an animal. Probably.",
      "Cut marks near the end. Someone was working on it.",
      "I always forget bones are objects until they're in a case.",
    ],
    tablet: [
      "It's a receipt. Nine-tenths of everything ever written is a receipt.",
      "Imagine being the first person to read that in six thousand years.",
      "Nobody's translated it. Nobody can.",
      "Wet clay, a reed, and a whole civilisation's admin.",
      "That's someone's shopping list. Or a lawsuit. Same difference.",
    ],
    figurine: [
      "Its hands are over its face.",
      "Why are the hands over the face?",
      "There's nothing carved underneath. I checked.",
      "It's small enough to hold. Someone did hold it.",
      "Every one of these has a different face. Except when they don't.",
    ],
    bead: [
      "Someone graded these by size. They wanted them looked at.",
      "The holes were drilled from both ends and met perfectly in the middle.",
      "That's a necklace. That's somebody's necklace.",
      "All that work for something that sits against a throat.",
    ],
    astrolabe: [
      "They were doing spherical trigonometry with that.",
      "I couldn't work that out with a laptop.",
      "The star pointers are all filed by hand.",
      "That's a computer. Made of brass. For the sky.",
    ],
    bell: [
      "I wonder what it sounded like.",
      "There's writing round the waist of it.",
      "They must have heard that for miles.",
      "Cast, not beaten. You can see the seam if you look.",
    ],
    vessel: [
      "A pot. And I can't stop looking at it.",
      "The walls are so thin. They trusted their clay.",
      "Storage. Ceremony. Dinner. We don't know which, and it matters.",
      "Somebody's kitchen. In a case.",
    ],
    sherd: [
      "Half a pattern. I can see the rest of it in my head.",
      "Even the rubbish is painted.",
      "A broken pot, and they still accessioned it. Correctly.",
    ],
    seal: [
      "You rolled that across wet clay and that was your signature.",
      "A whole identity on something the size of a thumb.",
      "The carving is backwards. Of course it is — it's a stamp.",
    ],
    mirror: [
      "The back is more interesting than the face. It always is.",
      "Polished metal. Someone saw themselves in that.",
      "I'd love to know what they saw when they looked.",
    ],
    torc: [
      "That's a neck ring. Status you can weigh.",
      "Twisted metal. Hours of work for something you wear once and keep forever.",
      "Heavy. Deliberately heavy. You're meant to feel it.",
    ],
    key: [
      "A key without a door. That's a whole novel.",
      "Someone locked something and never came back.",
      "The teeth are still sharp. It still works. Somewhere.",
    ],
    bottle: [
      "Bottle glass. The nineteenth century in one colour of green.",
      "Still a bottle shape after all that pressure.",
    ],
    cap: ["A bottle top. In a museum. And I'm not even joking.",
          "That's us. That's what we leave."],
    nail: ["A nail. Hand-forged. Someone made each one.",
           "The square section. Before wire nails. Before everything."],
    ledger: [
      "It's a set of accounts. For bringing soil here.",
      "Forty years of carting fill. To a place nobody was digging.",
      "I want to read every page. I also don't.",
    ],
    /* Egypt */
    scarab: [
      "A scarab. Beetle of rebirth, stamped into stone.",
      "The underside is a seal. The top is a prayer.",
      "Someone wore that against their skin.",
      "Heart scarab. It went on the chest. For the weighing.",
    ],
    canopic: [
      "That's a canopic jar. Organs. For the next life.",
      "The head on the lid is the whole theology.",
      "Four jars. Four sons of Horus. This is one of them.",
      "They packed carefully. For a very long journey.",
    ],
    ankh: [
      "The key of life. Everyone knows that shape.",
      "Gold, and small enough to hold. Deliberately.",
      "They put that in the hands of the dead.",
    ],
    ushabti: [
      "A servant figure. It does your work in the afterlife.",
      "There's a spell down the front. The job description.",
      "They made hundreds. This one got chosen for the deposit.",
    ],
    pectoral: [
      "A broad collar. Status you can hang on a neck.",
      "The inlay is still sharp. Look at the colours.",
      "That's jewellery for a tomb and a coronation both.",
    ],
    /* Dinosaur elements */
    dinoTooth: [
      "That's a dinosaur tooth. Serrated. A meat-eater.",
      "The serrations are still there. Like a steak knife.",
      "From {depth}. A tooth from an animal that size. From {depth}.",
      "I can almost hear the bite.",
      "That's not a fossil in a book. That's a tooth in a case.",
    ],
    dinoBone: [
      "A limb bone. Look at the ends — the knuckle is the size of my fist.",
      "Hollow in the middle. Birds still do that.",
      "Someone packed a dinosaur bone into a human deposit. On purpose.",
    ],
    dinoFemur: [
      "That's a femur. The weight-bearing bone. Look at the head.",
      "You could not lift that easily. The animal walked on it.",
      "Proximal end, distal condyles — it's a textbook, in bone.",
      "Part of a kit. There should be a tibia to match.",
    ],
    dinoTibia: [
      "Lower leg. The thin one next to it would have been the fibula.",
      "It's elegant. For something that held up a house.",
      "We're building a skeleton. That's a shin.",
    ],
    dinoHumerus: [
      "Forelimb. Smaller than the hind — a theropod, almost certainly.",
      "The muscle scars are still on it. You can see where it pulled.",
    ],
    dinoJaw: [
      "Lower jaw. Look at the tooth sockets.",
      "Dentary. Full of teeth that aren't there any more.",
      "It would have hinged right there. You can see the articular surface.",
    ],
    dinoVert: [
      "A vertebra. The canal is where the cord went.",
      "Neural spine on top. Processes out the sides. It's architecture.",
      "Stack enough of these and you get a dinosaur.",
    ],
    dinoRib: [
      "Ribs. Curved like barrel staves.",
      "A whole cage. To hold a heart the size of a car engine.",
      "They flex. Or they did, when there was something inside.",
    ],
    dinoPelvis: [
      "The hip. The whole animal hangs off that.",
      "Acetabulum — the socket. The femur sat there.",
      "That's the centre of the mount. Everything else is decoration.",
    ],
    dinoTail: [
      "Caudals. The tail. Counterweight and weapon both.",
      "They get smaller as they go. You can count the taper.",
      "A whole series. Not one bone — a paragraph of them.",
    ],
    dinoClaw: [
      "That claw. Curved like a question mark.",
      "Sickle claw. You don't want that in a handshake.",
      "The sheath is gone. The core is enough.",
      "That's the one on the posters. Or it will be.",
    ],
    eggFossil: [
      "A dinosaur egg. Mineralised all the way through.",
      "Someone's nest. Or part of one.",
      "The shell texture is still on it if you catch the light.",
    ],
    trackSlab: [
      "Footprints. Three toes. Walking, not running.",
      "A trackway. Someone — something — went that way.",
      "The mud set. Then the world put a mountain on it. Then we dug it up.",
    ],
    /* Fossils */
    ammonite: [
      "An ammonite. The spiral is the whole animal's life in one shape.",
      "Chamber by chamber. It grew outward and never went back.",
      "Pyrite in the sutures. Fool's gold on a real fossil.",
    ],
    trilobite: [
      "A trilobite. Older than trees. Older than fish, almost.",
      "The segments still articulate in your head when you look.",
      "Enrolled — it curled up. Like a woodlouse. Half a billion years ago.",
    ],
    fernFossil: [
      "A fern. Carbon on stone. A leaf that kept its shape.",
      "You can count the pinnae. It's a drawing made by geology.",
    ],
    fishFossil: [
      "A whole fish. On a slab. The bones are still in order.",
      "Scales and spine. It died and the mud loved it.",
    ],
    coralFossil: [
      "Coral. A whole colony, turned to stone.",
      "It built a reef. Then the reef became a mountain. Then a case.",
    ],
    crinoid: [
      "A sea lily. Not a plant — an animal on a stalk.",
      "The stem segments look like buttons. They stacked for metres.",
    ],
    /* Minerals */
    geode: [
      "A geode. Ugly rock, cathedral inside.",
      "The crystals grew into the void. Nobody told them to stop.",
      "I'd put that under a spotlight and charge extra.",
    ],
    crystal: [
      "Terminated crystals. Faces you could cut yourself on.",
      "That's not tumbled. That's how it grew.",
      "The light goes through and comes out as a different argument.",
    ],
    goldNugget: [
      "Native gold. No smelting. Just the metal, as found.",
      "Heavy. You can tell from here.",
      "Someone picked that out of a river. Or a vein. Or a miracle.",
    ],
    meteorite: [
      "A meteorite. Not from this planet's usual catalogue.",
      "The fusion crust is still on it. It burned on the way in.",
      "Iron from the sky. In a field. In a shaft. In a case.",
    ],
    opal: [
      "Play-of-colour. It changes when you move.",
      "That's not paint. That's structure. Light getting lost on purpose.",
    ],
    pyrite: [
      "Fool's gold. Cubic. Nature doing geometry homework.",
      "The faces are perfect. Annoyingly perfect.",
    ],
    fluorite: [
      "Fluorite. Octahedra. Soft enough to carve, hard enough to keep.",
      "The colour bands are growth rings. Mineral trees.",
    ],
  };

  /* ---------- skeleton kits (species + part) -------------------------------- */

  const BY_SKELETON_KIT = {
    tyrant: [
      "A tyrant. The big one. The one on every poster eventually.",
      "Theropod. Meat-eater. You can tell from the teeth if you've got them.",
      "We're building a tyrant in this room. Bone by bone.",
      "When this is mounted, people will fly here for it.",
    ],
    longneck: [
      "Sauropod. Long neck, small head, legs like pillars.",
      "The sheer tonnage of the animal is the point.",
      "A walking geology. And someone packed it for us.",
    ],
    raptor: [
      "Sickle-claw. Fast, smart, unfriendly.",
      "Smaller than the films. Meaner than the films.",
      "That claw is the whole brand.",
    ],
    plateback: [
      "Plated herbivore. Armour as lifestyle.",
      "Not a predator. Still not something you'd lean on.",
    ],
  };

  const BY_SKELETON_PART = {
    skull: [
      "The skull. The face of the whole mount.",
      "Once you have the skull, the rest of the skeleton has a job.",
      "Orbits, teeth, jaw hinge — it's a machine for being alive.",
      "That's the piece that stops the room.",
    ],
    jaw: [
      "Lower jaw. Without it the skull is only half a threat.",
      "Tooth sockets empty. Imagination fills them in.",
    ],
    cervical: [
      "Neck vertebrae. S-curve if it's a theropod, crane if it's a sauropod.",
      "Stack these and the head gets places.",
    ],
    dorsal: [
      "Back vertebrae. The ridge the ribs hang from.",
      "Architecture. Load-bearing bone.",
    ],
    ribs: [
      "The rib cage. Room for a heart you could live in.",
      "Barrel staves for an animal.",
    ],
    pelvis: [
      "Pelvis. The centre of the mount. Everything hangs from here.",
      "Hip socket still readable. The femur went there.",
    ],
    femur: [
      "Femur. Biggest limb bone. The weight went through this.",
      "When they mount it, this is a pillar.",
    ],
    tibia: [
      "Tibia. Lower leg. Elegant, for a column.",
      "Paired with a femur it becomes a stride.",
    ],
    humerus: [
      "Humerus. Forelimb. Smaller on a runner, huge on a grazer.",
      "Muscle scars. You can see where it worked.",
    ],
    claw: [
      "A claw from the foot. Not the famous sickle — the ordinary nightmare.",
      "Pedal claw. For traction. And argument.",
    ],
    scythe: [
      "The sickle claw. The one in the logo.",
      "That's a weapon that evolved into a brand.",
    ],
    tail: [
      "Tail series. Balance, display, occasionally violence.",
      "Caudals tapering to nothing. A whole paragraph of bone.",
    ],
  };

  const BY_MOUNT = [
    "They assembled this. Every bone from the shaft. Every single one.",
    "A complete mount. This is why the Hall of Dinosaurs exists.",
    "I came for the paintings. I'm staying for this.",
    "The armature is steel. The animal is time.",
    "Kids are going to lose their minds. Correctly.",
    "This is a destination. People will plan holidays around this.",
    "Bone by bone out of a field. Mounted in a town museum. Unreal.",
    "The rating of this place just went through the roof. You can feel it.",
  ];

  /* ---------- by tradition -------------------------------------------------- */

  const BY_CULTURE = {
    modern: [
      "Somebody's rubbish is somebody else's collection.",
      "That was on my desk. That exact one.",
      "We're the overburden. That's the joke.",
      "In two hundred years this is all they'll have of us.",
    ],
    industrial: [
      "Every field in the country has a layer of that in it.",
      "Bottle glass and cut nails. The nineteenth century in two objects.",
      "Soot in the soil. Progress, basically.",
    ],
    victorian: [
      "They never say who the sitter was. It's always 'an unnamed gentleman'.",
      "He looks like he's holding his breath.",
      "Imported taste. Local money. The usual story.",
    ],
    renaissance: [
      "Look at the little window behind the head. There's a whole landscape in there.",
      "That's egg tempera. On a panel. Astonishing it survived.",
      "Perspective as a party trick. And then as a religion.",
    ],
    edo: [
      "The flatness of it is the whole point. No shadows anywhere.",
      "That wave. Everyone knows that wave.",
      "The red seal in the corner is the signature.",
      "Ukiyo-e. Floating world. Still floating.",
    ],
    mughal: [
      "Every one of those figures is about six millimetres tall.",
      "That's gold leaf, burnished with an agate.",
      "A whole court on a leaf of paper.",
    ],
    benin: [
      "Lost-wax casting, and they were doing it better than Europe was.",
      "The collar is dozens of separate rings. Cast as one piece.",
      "There's a whole royal workshop behind that.",
      "Brass that remembers a palace.",
    ],
    byzantine: [
      "The eyes are deliberately too big. It's supposed to be looking back at you.",
      "Gold ground so there's no depth. No depth means no time.",
      "An icon. Not a picture — a presence.",
    ],
    norse: [
      "Two animals eating each other, forever. That's the whole design language.",
      "There's runes along the bottom edge.",
      "Ship people. Grave people. Pattern people.",
    ],
    song: [
      "Nine-tenths of it is empty paper and it's the best thing in the room.",
      "The mist isn't painted. It's just where they stopped.",
      "Ink and water and restraint. That's the skill.",
    ],
    islamic: [
      "Not one living thing depicted, and it's the most alive room in here.",
      "That tiling doesn't repeat. Look at it. It doesn't repeat.",
      "Geometry as devotion.",
    ],
    khmer: [
      "The drapery is carved so thin you can see the leg through it.",
      "It came off a doorway. There's a whole temple this belongs to.",
      "Sandstone that used to hold up a skyline.",
    ],
    rome: [
      "They mass-produced these. There's a workshop mark on the back.",
      "That's a real face. Somebody's actual face.",
      "Empire as a set of standard parts.",
      "A portrait bust. Propaganda you can walk around.",
    ],
    greece: [
      "Black-figure. The detail is scratched back through the slip with a needle.",
      "The meander band runs all the way round without a single mistake.",
      "They invented a lot of our bad ideas and most of our good ones.",
    ],
    han: [
      "Every one of those tomb figures has a different face.",
      "There are thousands more of these still in the ground somewhere.",
      "An army for the afterlife. Bureaucracy included.",
    ],
    maya: [
      "The glyph blocks are read in pairs. Left, right, down.",
      "That blue. Nobody has fully explained how they made that blue.",
      "Calendar, kingship, blood, stars. On a page.",
    ],
    nazca: [
      "The dyes are as strong as the day they were made.",
      "It's a textile. A textile survived. In the ground.",
      "Desert burial is the best conservator.",
    ],
    egypt: [
      "The column of text is the whole point. The picture is the caption.",
      "Head in profile, shoulders square on. Same rule for three thousand years.",
      "That's a servant figure. It was supposed to do your work for you afterwards.",
      "Nile logic. Order against chaos. Painted carefully.",
      "The Egyptian gallery is earning this museum's reputation.",
      "Canopic, scarab, ushabti — they packed for eternity.",
      "I came for the dinosaurs. I'm staying for the Nile.",
    ],
    minoan: [
      "Everything in it is swimming. Nothing stands on anything.",
      "They painted octopuses on their crockery. I love them.",
      "Crete before the stories got loud.",
    ],
    sumer: [
      "That's the oldest writing in the building.",
      "A stamp seal. You rolled it across wet clay to sign your name.",
      "Cities before most people had villages.",
    ],
    shang: [
      "The casting is so crisp. Piece-mould, not lost wax.",
      "It's a wine vessel. For the ancestors, not for you.",
      "Bronze that still means business.",
    ],
    indus: [
      "We still can't read their script. Not a word of it.",
      "Their cities had drains. Better drains than my street.",
      "Standard weights. Standard bricks. Quiet genius.",
    ],
    catal: [
      "That's a town, seen from above. Eight thousand years ago.",
      "They painted the walls of the rooms they lived in.",
      "No streets. You walked on the roofs.",
    ],
    jomon: [
      "The eyes. Why are the eyes like that?",
      "Every single one that's ever been found was broken before it was buried. On purpose.",
      "Cord-marked pottery and dogū that stare through you.",
    ],
    cucuteni: [
      "They burned their own villages down every sixty years and rebuilt them.",
      "The spirals are on everything. Everything.",
    ],
    gobekli: [
      "Hunter-gatherers built that. Before farming. Before pottery.",
      "It's a pillar. There were dozens of them, in a ring.",
      "The oldest monumental architecture we know. In a field. Then in this case.",
    ],
    magdalenian: [
      "That's a wall. Somebody cut a cave wall out and brought it here.",
      "Seventeen thousand years. Seventeen thousand.",
      "The animal follows the shape of the rock. They used the bulge for the shoulder.",
      "Cave art does not travel. This did.",
    ],
    gravettian: [
      "No face. They never gave them faces.",
      "There's ochre still in the grooves.",
      "A body, simplified, until it becomes a sentence.",
    ],
    neanderthal: [
      "That's not us. That's a different species, and it made that.",
      "Hands. They put their hands on the wall too.",
      "It isn't a tool. It doesn't do anything. They just wanted it to exist.",
      "Older than art is supposed to be. Better made than it has any right to be.",
    ],
    denisovan: [
      "We know them from a finger bone and a jaw. And this.",
      "Drilled, strung, worn. Someone wore that.",
      "A whole people, mostly missing. Except here.",
    ],
    cretaceous: [
      "Late Cretaceous. End of the dinosaurs' world.",
      "Sixty-six million years, then a bad day, then us.",
      "Packed in a human shaft. Don't think about it too hard.",
    ],
    jurassic: [
      "Jurassic. When the sauropods wrote the skyline.",
      "Older than chalk. Younger than despair.",
    ],
    triassic: [
      "Triassic. Early days. The experiment before the franchise.",
      "Before the famous ones. Still teeth. Still claws.",
    ],
    paleozoic: [
      "Paleozoic. Before dinosaurs. Before almost everything.",
      "Trilobites and ferns and sea lilies. A quieter apocalypse.",
      "Deep time, carefully boxed.",
    ],
    minerals: [
      "Not made. Grown. That's the difference.",
      "Cabinet specimens. Someone had taste.",
      "Geology as jewellery.",
    ],
    unattr_a: [
      "The card says 'no accepted context'. What does that mean?",
      "Its hands are over its face. They all are.",
      "It hasn't weathered. Look at it. It's been in the ground and it hasn't weathered.",
      "Group A. As if naming the shelf solves it.",
    ],
    unattr_b: [
      "Eight turns, counterclockwise. It's on everything down there.",
      "Nobody made this. That's what the label is trying not to say.",
      "I've been standing here four minutes. I don't know why.",
      "Group B is worse. I don't know how I know that.",
    ],
    unattr_c: [
      "The faces aren't modelled underneath the hands. There's nothing there.",
      "Group C. What happened to Group D?",
      "Can we go to the next room. Please.",
      "I don't want to know what comes after this gallery.",
    ],
    anachronic: [
      "The depth on that card can't be right.",
      "That's a wristwatch. From eight hundred metres down.",
      "Read the accession number. Now read the one on the next case.",
      "I want to speak to whoever wrote this label.",
      "Somebody put these here for us. In our own handwriting.",
    ],
  };

  /* ---------- by state of the object ---------------------------------------- */

  const BY_CONDITION = {
    frag: [
      "There's so little of it left.",
      "You can see about a tenth of what it was.",
      "Half a thing, and it still stops you.",
      "Fragments. And still the best thing in the case.",
      "They accessioned the pieces. Correctly.",
    ],
    poor: [
      "It's had a rough time.",
      "The surface has gone almost completely.",
      "Stable, the card says. Stable is doing a lot of work.",
      "Poor condition. Rich object.",
    ],
    part: [
      "Enough of it to know what it was, which is all you need.",
      "Incomplete — and honest about it.",
      "The missing bit is part of the story.",
    ],
    sound: [
      "That's basically complete. That's rare.",
      "Not a chip on it.",
      "Sound condition. From {depth}. Show-off.",
    ],
    fine: [
      "That is in extraordinary condition for its age.",
      "Better preserved than things four thousand years younger.",
      "Fine. The conservators are showing off.",
      "You could put that on a poster tomorrow.",
    ],
    excep: [
      "That is one of the best of its kind anywhere in the world.",
      "They flew a conservator in for that one.",
      "That's the one on the poster.",
      "Exceptional. The label is not exaggerating.",
      "This is why people pay the ticket price.",
    ],
  };

  const BY_RARITY = {
    common: [
      "A common type. And still worth a case.",
      "There are others like it. That doesn't make it nothing.",
    ],
    uncommon: [
      "You don't see many of these.",
      "Uncommon enough that I'm glad they put it out.",
    ],
    rare: [
      "Rare. The card says rare. The queue says rare.",
      "I've only ever seen these in books.",
      "A rare one. From {depth}.",
    ],
    signif: [
      "That's the one everyone comes for.",
      "There's a queue for this case at weekends.",
      "Significant. As in: rewrites the paragraph.",
      "They'll put this on the cover of the guidebook.",
    ],
    unique: [
      "There isn't another one. Anywhere. That's it.",
      "That object is the entire evidence for its own existence.",
      "Three separate universities have asked to borrow that.",
      "Unique. From {depth}. I need a minute.",
      "One of a kind. In a town museum. Unreal.",
    ],
  };

  /* ---------- depth / era flavour ------------------------------------------- */

  const BY_DEPTH = [
    { min: 0, max: 40, lines: [
      "Nearly surface. Still counts.",
      "Shallow find. Deep story, maybe.",
      "From the top of the shaft. Our century's rubbish, polished.",
    ]},
    { min: 40, max: 120, lines: [
      "A few dozen metres down. Already another world.",
      "From {depth}. Properly under the field.",
    ]},
    { min: 120, max: 250, lines: [
      "Hundreds of metres. The air feels different when you read that.",
      "From {depth}. Classical, bronze, whatever — it's far.",
      "The shaft goes on. This is only the middle.",
    ]},
    { min: 250, max: 400, lines: [
      "Deep. Properly deep. {depth}.",
      "Neolithic and older. The light gets careful in these rooms.",
      "You can feel the weight of the ground above it.",
    ]},
    { min: 400, max: 520, lines: [
      "Below four hundred metres. Older than art is supposed to be.",
      "The long dark. The labels get quieter here.",
      "From {depth}. I keep checking the number.",
    ]},
    { min: 520, max: 700, lines: [
      "Deep time. Dinosaurs. Minerals. From a human deposit.",
      "From {depth}. That's not a depth, that's a dare.",
      "Someone packed deep time into a field. For us.",
    ]},
    { min: 700, max: 9999, lines: [
      "Near the floor. The numbers stop making sense.",
      "From {depth}. Read it again.",
      "This is the bottom of the argument.",
    ]},
  ];

  /* ---------- the deep material --------------------------------------------- */

  const BY_EERIE = [
    [],
    [
      "Hang on, how deep did they say that came from?",
      "It's a long way from anywhere it should be.",
      "The layer above it was undisturbed. That's what the card says.",
      "Packed, not buried. There's a difference.",
      "Nine hundred kilometres from the usual findspot. Allegedly.",
    ],
    [
      "That's older than I thought people were.",
      "Something made that. It wasn't us.",
      "I don't like this room. It's the light, probably.",
      "Why is it in such good condition.",
      "The crew stopped asking questions. That's in the site report.",
    ],
    [
      "The label doesn't say what it is. It says what it isn't.",
      "Unattributed. That means nobody will put their name to a guess.",
      "It's the hands over the faces. That's the bit.",
      "There's no wear on any of them. None of them.",
      "How did they know to bury it in order?",
      "Group A, Group B, Group C. That's not a typology, that's a flinch.",
    ],
    [
      "That is newer than the ground it was found in and nobody will explain it.",
      "The number on the base is the next one they were going to issue.",
      "I'd like to leave now, if that's alright.",
      "Somebody put these here for us to find. In order. On purpose.",
      "Our accession sequence. Their deposit. Same handwriting.",
    ],
  ];

  /* ---------- who is speaking ------------------------------------------------ */

  const BY_TYPE = {
    child: [
      "Is it real?", "Is that a real one?", "Can I touch it?",
      "Why is it broken?", "Who broke it?", "Where's its head?",
      "That one's my favourite.", "Mum. Mum. MUM. Look.",
      "It's smaller than on the sign.", "How did it get in the hole?",
      "Are there bones?", "I want to see the bones.",
      "Is that a dinosaur tooth?!", "Dinosaur. Actual dinosaur.",
      "Why are its hands on its face?", "That's scary. I like it.",
      "Can we see the big skeleton?", "I drew this one in my book.",
      "Does it bite?", "I'm going to be an archaeologist. Or a dragon.",
      "It's looking at me.",
      "Can we get one in the shop?",
      "Why is that one in a box on its own?",
      "I've found the best one. Come and see the best one.",
      "How deep is deep?",
      "Are the people who made it still alive?",
      "I'm going to dig a hole when we get home.",
      "That's older than Grandad.",
      "Is the whole floor made of dinosaurs?",
    ],
    school: [
      "Miss, do we have to write about this one?",
      "How many more rooms are there?",
      "I'm putting this one in my project.",
      "Sir, is this the oldest thing in the world?",
      "Can we go to the shop after?",
      "That's on the worksheet. That's question four.",
      "Miss, the label says {depth}. Is that a lot?",
      "I need a photo for the slideshow.",
      "Is the dinosaur one in the next room?",
      "We're doing the Egyptians after break.",
      "Miss, he's touching the glass.",
      "I'm not touching it, I'm pointing NEAR it.",
      "Do we get to keep the worksheet?",
      "That's the biggest bone I've ever seen in my life.",
      "Sir, what's underneath the museum?",
      "If I dig in our garden will I find one?",
      "Miss, why did they bury it all?",
      "This is better than school.",
    ],
    scholar: [
      "The attribution is doing a lot of work on that label.",
      "I'd want to see the section drawing before I accepted that date.",
      "This is going to rewrite a chapter. Possibly a book.",
      "Whoever catalogued this was being extremely careful with their words.",
      "The comparanda simply don't exist.",
      "I've read the site report three times. It doesn't explain this.",
      "Note the manufacturing sequence. One sitting. Confident hand.",
      "The condition is exceptional for the depth. Suspiciously so.",
      "If the seriation holds, the next find should be… yes.",
      "I'd like a cast of that for the teaching collection.",
      "The spiral again. Eight turns. We need a paper just on that.",
      "Provenance is the whole story. The object is the footnote.",
      "I have three colleagues who need to see this and one who mustn't.",
      "The typology falls apart at this depth. Cheerfully.",
      "Someone will build a career on that case. It should be me.",
      "I'd date it by the wear pattern, not the form. The form is a red herring.",
      "There is no parallel. I've looked. There is no parallel.",
      "Whoever wrote the site report was being politely terrified.",
      "This will be argued about for thirty years and I intend to start.",
    ],
    tourist: [
      "Can you stand next to it? For scale.",
      "No flash. It says no flash.",
      "This is going straight on the internet.",
      "Get the label in the shot as well.",
      "I'm not going to remember any of this without a photo.",
      "Is this the famous one?",
      "We came from the city for this. Worth it.",
      "Smile. Don't smile. Look at the object.",
      "Hashtag site seven. Is that a hashtag?",
      "Nobody at home is going to believe the depth on that card.",
      "I've got four hundred photos and I've done two rooms.",
      "Wait, don't move, the light's doing something.",
      "That's the postcard. That's the one they should sell.",
      "We're doing the whole county and this is the best stop.",
      "Battery's going. Worth it.",
    ],
    elder: [
      "My father would have loved this.",
      "They didn't have any of this when I last came.",
      "Is there somewhere to sit further along?",
      "I've seen the one in the British Museum and this is better.",
      "Take your time. There's no prize for rushing.",
      "The labels are properly written. What a relief.",
      "I used to dig. Not like this. Gardens.",
      "Leave me here. I'll catch up at the café.",
      "I remember when this was all allotments.",
      "You young people rush. It's not a race.",
      "That's the finest thing I've seen in twenty years.",
      "My eyes aren't what they were, but that I can see.",
      "The bench, the label, the light. They've thought about all of it.",
      "I'll be dead before they reach the bottom. Somebody tell me how it ends.",
      "I've brought three generations through that door today.",
    ],
    staff: [
      "Mind the rope, please.",
      "There's a talk on that one at half past.",
      "No, you're fine, you can photograph it — just no flash.",
      "The deep gallery is through the arch and down the steps.",
      "It came out of the ground eleven weeks ago.",
      "If you're looking for the dinosaurs, keep going — you can't miss them.",
      "We've had three schools through already today.",
      "That mount was finished last month. Still proud of it.",
      "Ask me anything. I've read every label twice.",
      "Please don't lean on the case — it's older than the case.",
      "Yes, all of it. One site. I check the map myself sometimes.",
      "The café does a very good scone and I'm not being paid to say that.",
      "That one came up last Thursday. It's not even in the guidebook yet.",
      "If you've got half an hour, start at the bottom and work up.",
      "We're open till five. You've got time. Just.",
      "The children's trail is on the desk — free, take one.",
      "I'll be honest, that one frightens me a bit too.",
      "Careful on the steps, they're original.",
    ],
    adult: [
      "Hmm.",
      "Right.",
      "Okay, that's… okay.",
      "Read the depth. No, properly read it.",
    ],
  };

  /* ---------- ambient -------------------------------------------------------- */

  const AMBIENT = [
    "Do you want to do the café first or after?",
    "I've got about twenty minutes left on the parking.",
    "My feet have gone.",
    "Is there a loo on this floor?",
    "How much was the gift shop postcard? Ridiculous.",
    "We've been here an hour and we're in the second room.",
    "I'm going to come back on a weekday.",
    "Did you see the size of the queue outside?",
    "It's much bigger inside than it looks.",
    "They've done this really well, actually.",
    "This is a lot for a town this size.",
    "Apparently it all came out of one hole in a field.",
    "One hole. In a field. Seven miles from anything.",
    "I read about this in the paper.",
    "The lighting in here is beautiful.",
    "I could look at these all day.",
    "Right. Two more rooms and then lunch.",
    "Have you got the map? I've lost the map.",
    "Is it me or is it cold in this room?",
    "Whoever wrote these labels can actually write.",
    "The ticket was a steal for this.",
    "I'm coming back with my sister. She won't believe me.",
    "They've opened a new wing. Can you tell?",
    "The soundscape is doing a lot of quiet work.",
    "I like that you can rehang things. Very honest.",
    "School party behind us. Brace.",
    "If we skip the shop I'll only regret it later.",
    "This place is going to be famous. Give it a year.",
    "I keep forgetting it's all from one site.",
    "The Institute must be losing their minds with pride.",
    "I've walked past this building a hundred times.",
    "There's a bench in every room. Somebody has been in a museum before.",
    "That's the third thing today I didn't know existed.",
    "My phone's at four per cent and I don't care.",
    "Do you think they'll ever get to the bottom of it?",
    "I'd work here for nothing. Don't tell them that either.",
    "It smells like a proper museum. Dust and polish.",
    "We should have started at the top and worked down.",
    "I'm going to be thinking about this on the drive home.",
    "There's a woman here who's been in front of one case for an hour.",
    "Everything's from one site. I keep saying it and it keeps being mad.",
    "You could put any of this in a national museum tomorrow.",
    "Whoever chose the paint colour deserves a raise.",
    "It's the quiet that does it. Nobody's shouting at you to buy anything.",
    "I've written down four things to look up later.",
    "That's my afternoon gone and I regret nothing.",
    "Is it just me or does it get stranger the further down you go?",
    "They haven't over-explained it. That takes nerve.",
    "Two hours. We said one hour.",
    "I want to know who paid for all this.",
    "The cases are spotless. Someone does that every morning.",
    "I came for the dinosaurs and I'm staying for the pottery.",
    "My knees have opinions about the stairs.",
    "Somebody's put a lot of love into this.",
    "It's the sort of place you bring people to show off.",
    "I'll be honest, I expected a shed.",
  ];

  /* ---------- exchanges ------------------------------------------------------ */

  const PAIRS = [
    ["How old did you say?", "The card says it's older than the species."],
    ["Do you think it's a person or a god?", "I don't think they'd have seen a difference."],
    ["Would you have it in your house?", "I'd have all of it in my house."],
    ["What's it made of?", "It doesn't say. That's the interesting bit."],
    ["Why is it in this order?", "That's the question, isn't it."],
    ["Are you actually reading these?", "Only the strange ones."],
    ["That's the fourth spiral.", "I've stopped counting."],
    ["Do you want to see the deep gallery?", "Not really. But yes."],
    ["Is that a real one or a copy?", "Everything in here is real. That's the point."],
    ["I could do that.", "You couldn't do that."],
    ["Is the dinosaur hall worth it?", "It's the reason I came."],
    ["How many bones left for the mount?", "The panel said three. I'm counting."],
    ["Read the depth out loud.", "I did. It didn't help."],
    ["Café?", "After the Egypt room."],
    ["That label is doing a lot of work.", "The object is doing more."],
    ["Why is it so well preserved?", "That's what the site report won't answer."],
    ["Should we tip the staff?", "They're volunteers. Buy the postcard."],
    ["I'm scared of the hands-over-faces ones.", "Same. Keep walking."],
    ["Is this the unique one?", "The card says one of a kind. The room agrees."],
    ["Photograph or memory?", "Both. I'm greedy."],
    ["Do you believe the date?", "I believe the stratigraphy. That's worse."],
    ["Which was your favourite?", "Ask me at the end. I keep changing."],
    ["Are you cold?", "It's not the temperature."],
    ["Would you have dug it up?", "I'd have filled the hole back in."],
    ["What do you think it was for?", "Nothing. Some things aren't for anything."],
    ["Do we tell people about this place?", "Selfishly? No."],
    ["That's beautiful.", "That's the word, yes."],
    ["I don't understand the ordering.", "Neither does anybody. That's the exhibit."],
    ["How long have they been open?", "Not long. Look how fast it's filled up."],
    ["Have you seen the one with the hands?", "I have and I'd rather not again."],
    ["Do you want to sit down?", "In a minute. One more."],
    ["That's the second watch.", "Don't. Don't start."],
    ["Is any of this valuable?", "None of it's for sale. That's the whole point."],
    ["Did you read the ledger?", "Forty years of carting soil into a hole. Yes."],
    ["Do you think there's more down there?", "The card says the floor is at eight hundred metres."],
    ["Same time next month?", "Same time next week."],
    ["What would you take home?", "The bench. My feet have gone."],
  ];

  /* Contextual pair openers when both look at the same piece — second line still from PAIRS or generated. */
  const PAIR_ABOUT = [
    ["Look at the {name}.", "I am. I can't stop."],
    ["{depth}. From {depth}.", "Stop saying it. I know."],
    ["It's {material}.", "I can see that. It's still wrong somehow."],
    ["{culture}.", "Say it again slower."],
    ["The condition says {name} is exceptional.", "The condition understates it."],
    ["This is the one from the paper.", "It looked smaller in print."],
  ];

  /* ---------- what they are doing --------------------------------------------
     Keyed to the action rather than the object. Said as somebody changes
     attitude in front of a case — steps back, gets the pad out, crouches —
     so the line explains the body language. */

  const BY_ACT = {
    read: [
      "Hang on, let me read it properly.",
      "Right — so it's not what I thought at all.",
      "Whoever wrote this card knew what they were doing.",
      "It doesn't say who made it. It says nobody knows.",
      "Read the last line. Go on, read the last line.",
      "The card's more interesting than half the room.",
      "I like a label that admits what it doesn't know.",
      "Two sentences and I've changed my mind about it.",
      "It's the depth that gets me. Every time, it's the depth.",
      "Hold on. Hold on. Read that again.",
      "They've put the accession number on. That's a proper museum.",
      "I always read them. Otherwise what's the point of coming.",
    ],
    sketch: [
      "I'll never draw it as well as it is.",
      "Give me a minute. I want the proportions right.",
      "Photographs flatten it. Drawing makes you look.",
      "Nobody's published a decent line drawing of this.",
      "The curve on the shoulder — that's the thing to get.",
      "I'm not leaving until I've got this down.",
      "You see far more when you have to draw it.",
      "That's for the paper. That's definitely for the paper.",
      "My hand's cold and I don't care.",
      "One more angle and then the café.",
    ],
    photo: [
      "No flash. I know. It's off.",
      "The light's actually perfect right there.",
      "That's the one. That's the shot.",
      "I'll never look at this again but I'm taking it anyway.",
      "Get the whole case in.",
      "It won't come out. It never comes out.",
      "Stand still — the shutter's slow in here.",
      "That's going on the wall at home.",
    ],
    selfie: [
      "Right — me, and it, and nobody else in shot.",
      "Nobody's going to believe where this came from.",
      "One with the label. One without.",
      "My face and something eleven thousand years old.",
      "This is the only photo I'll actually keep.",
      "Do I look like I understand it?",
      "Move a bit — you're in front of the good one.",
    ],
    point: [
      "There. Look at that bit there.",
      "That's what I was telling you about.",
      "See the mark? See it? That's a tool.",
      "Look where the crack goes. It goes right through.",
      "That one. That's the one from the paper.",
      "Look at its face. Look at its FACE.",
    ],
    crouch: [
      "It's better from down here.",
      "You can see underneath if you get low.",
      "There's writing on the bottom!",
      "Mum, get down here, you can see the little bit.",
      "The label's at grown-up height. That's rubbish.",
      "It's tiny. It's so tiny and so old.",
    ],
    gaze: [
      "You have to stand back to get it.",
      "It's bigger than the room wants it to be.",
      "Somebody carried this. Somebody carried this here.",
      "I've gone all cold looking at it.",
      "How do you even move something that size?",
      "It doesn't fit. That's rather the point.",
      "You can't take it in from close up. Come back here.",
      "Whole thing. In one piece. Out of a hole in a field.",
    ],
    look: [
      "Hm.",
      "Right, yes.",
      "I could look at this for a while.",
      "Well, that's rather good.",
    ],
  };

  /* ---------- guided tours ---------------------------------------------------- */

  const GUIDE_OPEN = [
    "If you'd like to follow me — this way, mind the rope.",
    "Everyone comfortable? Good. This is the one I actually came here for.",
    "Gather round, there's room. Nobody has to be at the front.",
    "Stop me if you have a question. People never do, and they should.",
    "Right. Twenty minutes, four objects, one thing that will annoy you.",
  ];

  const GUIDE_ABOUT = [
    "This came out of the ground at {depth}. The {era} horizon.",
    "It's {material}, and the tooling on it is finer than it has any right to be.",
    "{culture}. Or so the card says. The card is being careful.",
    "The condition is exceptional. At that depth it should not be.",
    "Notice nobody dug this up in pieces. It came up whole.",
    "Look at the spiral. Eight turns. You'll see it again in the next room.",
    "We've had three specialists look at this. They agree on the date and nothing else.",
    "You are, genuinely, among the first few thousand people to see this.",
    "Every object on this floor came out of one hole, seven miles from here.",
    "The deposit is ordered. Oldest at the bottom. Somebody put it that way.",
    "I've been asked whether it's a copy. Nothing in this building is a copy.",
    "The person who made this had a name. We will never have it.",
    "If you take one thing away, take the depth. Read it and let it sit.",
    "Questions? — Yes, we do know how strange that is. No, we can't explain it.",
    "The Institute would rather I didn't say 'impossible'. So I won't.",
  ];

  const TOUR_JOIN = [
    "Are we allowed to just join in?",
    "Come on, she's starting.",
    "Free tour. Obviously we're joining.",
    "Shh — he's about to do the good one.",
    "I want to hear this bit.",
    "Follow the badge, that's the rule.",
  ];

  /* ---------- lost ----------------------------------------------------------- */

  const LOST = [
    "Which way is the Bronze Age?",
    "We've done this room. Haven't we done this room?",
    "The map says there's another floor.",
    "Hold on. Where are we.",
    "I think we've gone round in a circle.",
    "Is the dinosaur hall up or down?",
    "This plan is not to scale.",
    "Right — stairs, then left, then the big one.",
    "We've missed a room. I can feel it.",
    "There's a whole wing we haven't seen.",
  ];

  /* ---------- the museum as it is today ---------------------------------------
     Lines keyed to the state the player has actually put the place in: what
     they charge, how busy it is, how good the collection has got, how close it
     is to closing. Visitors noticing your decisions is worth more than any
     number of lines about pottery. */

  const MOOD = {
    dear: [
      "For what they're charging I want to see every room.",
      "It wasn't cheap. Mind you, look at it.",
      "That ticket price is ambitious for a town this size.",
      "I've paid less to see less, so I'll stop complaining.",
      "At that price they can afford to write good labels. And they have.",
      "Steep. Worth it. Both things can be true.",
    ],
    cheap: [
      "For what we paid this is daylight robbery. In our favour.",
      "I'd have paid triple. Don't tell them.",
      "That's the best value day out I've had in years.",
      "It's practically free. How are they keeping the lights on?",
      "I'm putting the difference in the donations box.",
      "Cheaper than the car park, and better.",
    ],
    busy: [
      "It's heaving. That's a good sign, I suppose.",
      "I can't get near the case.",
      "Come back on a Tuesday, that's my advice.",
      "There's a queue for the dinosaur. A queue.",
      "Word's got out about this place.",
      "Wait for the school party to move on and then we'll look.",
    ],
    quiet: [
      "We've got the whole room to ourselves.",
      "I like it empty. You can hear the building.",
      "More people should know about this.",
      "It's a shame. It deserves a crowd.",
      "Nobody here but us and about nine thousand years.",
      "Empty museum on a weekday. Nothing better.",
    ],
    famous: [
      "I came four hours for this.",
      "It's in every paper. Now I see why.",
      "This is a national collection in a town hall.",
      "People are flying in for this. Actually flying in.",
      "I told them it was worth the trip. I was underselling it.",
      "Twenty years from now everyone will claim they came early.",
    ],
    obscure: [
      "Nobody I know has heard of this place.",
      "Small, but they've clearly tried.",
      "Give it a year. They're onto something.",
      "It's a start. There's a lot of empty wall.",
      "You can tell they're just getting going.",
    ],
    closing: [
      "How long have we got? Ten minutes?",
      "They'll be closing soon. Quick — the big one.",
      "Last room. Make it count.",
      "I've heard the bell. I'm ignoring the bell.",
      "We'll have to come back. We've barely started.",
    ],
    opening: [
      "First ones in. Best time to come.",
      "Nothing's warmed up yet, including me.",
      "They've only just unlocked the doors.",
      "I like it before the crowds get in.",
    ],
  };

  /* ---------- on the way out --------------------------------------------------- */

  const LEAVING = [
    "Right. That's me done in.",
    "I'll come back when they've dug further.",
    "Thank you — that was genuinely wonderful.",
    "Same time next month.",
    "I'm telling everyone about this.",
    "My feet are finished and my head is full.",
    "One more look at the big one and then home.",
    "Best four hours I've spent this year.",
    "I didn't expect to be moved by a hole in a field.",
    "Where did the afternoon go?",
    "Do we have to? Can't we stay?",
    "I'm going to dream about the one with the hands.",
    "Signing the book on the way out. It deserves it.",
    "Car park. Then chips. Then talking about it for a week.",
  ];

  /* ---------- assembly -------------------------------------------------------- */

  function fill(line, a) {
    if (!line) return line;
    if (!a) return line;
    const cu = S7.cultures.byId[a.cultureId];
    const era = S7.cultures.eraAt(a.depth);
    let part = "";
    if (a.skeletonPart && S7.skeletons && S7.skeletons.PARTS[a.skeletonPart])
      part = S7.skeletons.PARTS[a.skeletonPart].label.toLowerCase();
    return line
      .replace(/\{culture\}/g, cu ? cu.short : "unknown")
      .replace(/\{name\}/g, (a.name || "piece").replace(/,.*$/, "").toLowerCase())
      .replace(/\{material\}/g, S7.artifacts.materialLabel(a.material).toLowerCase())
      .replace(/\{period\}/g, cu ? cu.period : "unknown")
      .replace(/\{era\}/g, era.name.toLowerCase())
      .replace(/\{depth\}/g, Math.round(a.depth) + " m")
      .replace(/\{part\}/g, part || "bone");
  }

  function depthLines(a) {
    if (!a) return null;
    for (const b of BY_DEPTH)
      if (a.depth >= b.min && a.depth < b.max) return b.lines;
    return null;
  }

  /* Picks a line for a visitor of `type` standing in front of `a`.
     Contextual buckets dominate; ambient is a rare garnish so the room
     sounds like people looking at things, not a café queue. */
  function forExhibit(rng, a, type) {
    const cu = a ? S7.cultures.byId[a.cultureId] : null;
    const buckets = [];
    const add = (pool, w) => {
      if (!pool) return;
      const list = pool.filter ? pool.filter(Boolean) : pool;
      if (list && list.length) buckets.push({ pool: list, w });
    };

    if (a) {
      if (a.skeletonMount) {
        add(BY_MOUNT, 80);
        if (a.skeletonId) add(BY_SKELETON_KIT[a.skeletonId], 40);
      } else {
        add(BY_KIND[a.kind], 28);
        if (a.objectType) add(BY_OBJECT[a.objectType], 42);
        if (a.skeletonId) add(BY_SKELETON_KIT[a.skeletonId], 36);
        if (a.skeletonPart) add(BY_SKELETON_PART[a.skeletonPart], 40);
        add(BY_CULTURE[a.cultureId], 38);
        if (a.condition) add(BY_CONDITION[a.condition.id], 12);
        if (a.rarity) add(BY_RARITY[a.rarity.id], 16);
        add(depthLines(a), 14);
        if (cu) add(BY_EERIE[cu.eerie], Math.max(0, cu.eerie) * 18);
      }
    }
    add(BY_TYPE[type], type === "adult" ? 6 : 28);
    add(AMBIENT, a ? 5 : 60);

    if (!buckets.length) return fill(rng.pick(AMBIENT), a);
    const b = rng.weighted(buckets, (x) => x.w);
    return fill(rng.pick(b.pool), a);
  }

  const ambient = (rng, type) => {
    const pool = BY_TYPE[type];
    if (pool && rng.chance(0.45)) return rng.pick(pool);
    return rng.pick(AMBIENT);
  };

  const pair = (rng, a) => {
    if (a && rng.chance(0.55)) {
      const p = rng.pick(PAIR_ABOUT);
      return [fill(p[0], a), fill(p[1], a)];
    }
    return rng.pick(PAIRS);
  };

  /* A line for what somebody is doing right now, falling back to the object
     itself when the action has nothing interesting to say. */
  function forAct(rng, act, a, type) {
    const pool = BY_ACT[act];
    if (pool && rng.chance(0.72)) return fill(rng.pick(pool), a);
    return forExhibit(rng, a, type);
  }

  const guide = (rng, a) =>
    fill(rng.pick(rng.chance(0.18) ? GUIDE_OPEN : GUIDE_ABOUT), a);

  /* Lines about the state the player has put the museum in. `ctx` carries the
     price against the going rate, how full the rooms are, the rating and the
     time of day; any of them may be missing. Returns null when nothing about
     today is worth remarking on, so the caller falls back to ordinary chat. */
  function mood(rng, ctx) {
    if (!ctx) return null;
    const buckets = [];
    const add = (pool, w) => { if (pool && pool.length && w > 0) buckets.push({ pool, w }); };
    const ratio = ctx.suggested > 0 ? ctx.price / ctx.suggested : 1;
    if (ratio > 1.3) add(MOOD.dear, 30);
    if (ratio < 0.75) add(MOOD.cheap, 26);
    if (ctx.crowded > 0.8) add(MOOD.busy, 26);
    else if (ctx.crowded < 0.18) add(MOOD.quiet, 20);
    if (ctx.rating >= 62) add(MOOD.famous, 22);
    else if (ctx.rating < 12) add(MOOD.obscure, 18);
    if (ctx.minutesLeft !== undefined && ctx.minutesLeft < 55) add(MOOD.closing, 34);
    else if (ctx.minutesOpen !== undefined && ctx.minutesOpen < 45) add(MOOD.opening, 20);
    if (!buckets.length) return null;
    return rng.pick(rng.weighted(buckets, (x) => x.w).pool);
  }

  S7.remarks = {
    forExhibit, forAct, ambient, pair, guide, mood,
    BY_KIND, BY_OBJECT, BY_CULTURE, BY_EERIE, BY_TYPE, BY_ACT,
    AMBIENT, PAIRS, GUIDE_ABOUT, TOUR_JOIN, LOST, LEAVING, MOOD,
  };
})(window.S7 = window.S7 || {});
