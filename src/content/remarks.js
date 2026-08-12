/* ============================================================================
   REMARKS

   What visitors say. Three sources, in descending priority:

     1. the specific object in front of them — its class, its culture, its
        condition, and how far down the shaft it came from
     2. who is saying it — a nine-year-old and a visiting scholar do not have
        the same reaction to a Neanderthal hand stencil
     3. ambient museum chatter, which is about the café

   Placeholders: {culture} {name} {material} {period} {depth} {era}
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
    ],
    sculpture: [
      "You want to touch it. You're not allowed, but you want to.",
      "Whoever carved this knew exactly where the light was going to fall.",
      "It's the missing bits that get me. Where did the arms go?",
      "It's been looked at by more people in this room than in a thousand years.",
      "Walk round it — it changes completely from the other side.",
      "Imagine the size of the block they started with.",
      "Someone had to carry this up eight hundred metres of shaft.",
      "The tool marks on the back are rougher. Nobody was meant to see that side.",
      "It's got a face like my uncle.",
      "There's still paint in the crevices. It would have been bright.",
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
    ],
  };

  /* A few object types are distinctive enough to deserve their own lines. */
  const BY_OBJECT = {
    coin: ["No wear on it at all. Struck and buried, never spent.",
           "You could still spend that, in the right century.",
           "There's the spiral again. Eight turns. It's on half the things in here."],
    blade: ["Still an edge on it. After all this time.",
            "The rivet holes are drilled, not punched. That's precision.",
            "They sharpened this so many times the shape changed."],
    lamp: ["It's still got fuel in it. It was never lit.",
           "Someone filled that lamp, set it down in the dark, and walked away.",
           "No soot at the spout. Not once."],
    watch: ["That's — hang on. What's the label say? Read the label again.",
            "That can't be right. Look at the depth on the card.",
            "My grandad had one like that."],
    marker: ["That's the same pattern the survey office still uses.",
             "There's a number stamped on the cap. Does anyone know what it means?",
             "I don't like that one. I don't know why."],
    console: ["Oh my god, I had one of those.",
              "The cartridge is still in it!",
              "Two hundred years from now that's what they'll dig up of us."],
    bonefrag: ["Is that — is that a person?",
               "The card says probably an animal. Probably.",
               "Cut marks near the end. Someone was working on it."],
    tablet: ["It's a receipt. Nine-tenths of everything ever written is a receipt.",
             "Imagine being the first person to read that in six thousand years.",
             "Nobody's translated it. Nobody can."],
    figurine: ["Its hands are over its face.",
               "Why are the hands over the face?",
               "There's nothing carved underneath. I checked."],
    bead: ["Someone graded these by size. They wanted them looked at.",
           "The holes were drilled from both ends and met perfectly in the middle.",
           "That's a necklace. That's somebody's necklace."],
    astrolabe: ["They were doing spherical trigonometry with that.",
                "I couldn't work that out with a laptop.",
                "The star pointers are all filed by hand."],
    bell: ["I wonder what it sounded like.",
           "There's writing round the waist of it.",
           "They must have heard that for miles."],
  };

  /* ---------- by tradition -------------------------------------------------- */

  const BY_CULTURE = {
    modern: ["Somebody's rubbish is somebody else's collection.",
             "That was on my desk. That exact one."],
    industrial: ["Every field in the country has a layer of that in it.",
                 "Bottle glass and cut nails. The nineteenth century in two objects."],
    victorian: ["They never say who the sitter was. It's always 'an unnamed gentleman'.",
                "He looks like he's holding his breath."],
    renaissance: ["Look at the little window behind the head. There's a whole landscape in there.",
                  "That's egg tempera. On a panel. Astonishing it survived."],
    edo: ["The flatness of it is the whole point. No shadows anywhere.",
          "That wave. Everyone knows that wave.",
          "The red seal in the corner is the signature."],
    mughal: ["Every one of those figures is about six millimetres tall.",
             "That's gold leaf, burnished with an agate."],
    benin: ["Lost-wax casting, and they were doing it better than Europe was.",
            "The collar is dozens of separate rings. Cast as one piece.",
            "There's a whole royal workshop behind that."],
    byzantine: ["The eyes are deliberately too big. It's supposed to be looking back at you.",
                "Gold ground so there's no depth. No depth means no time."],
    norse: ["Two animals eating each other, forever. That's the whole design language.",
            "There's runes along the bottom edge."],
    song: ["Nine-tenths of it is empty paper and it's the best thing in the room.",
           "The mist isn't painted. It's just where they stopped."],
    islamic: ["Not one living thing depicted, and it's the most alive room in here.",
              "That tiling doesn't repeat. Look at it. It doesn't repeat."],
    khmer: ["The drapery is carved so thin you can see the leg through it.",
            "It came off a doorway. There's a whole temple this belongs to."],
    rome: ["They mass-produced these. There's a workshop mark on the back.",
           "That's a real face. Somebody's actual face."],
    greece: ["Black-figure. The detail is scratched back through the slip with a needle.",
             "The meander band runs all the way round without a single mistake."],
    han: ["Every one of those tomb figures has a different face.",
          "There are thousands more of these still in the ground somewhere."],
    maya: ["The glyph blocks are read in pairs. Left, right, down.",
           "That blue. Nobody has fully explained how they made that blue."],
    nazca: ["The dyes are as strong as the day they were made.",
            "It's a textile. A textile survived. In the ground."],
    egypt: ["The column of text is the whole point. The picture is the caption.",
            "Head in profile, shoulders square on. Same rule for three thousand years.",
            "That's a servant figure. It was supposed to do your work for you afterwards."],
    minoan: ["Everything in it is swimming. Nothing stands on anything.",
             "They painted octopuses on their crockery. I love them."],
    sumer: ["That's the oldest writing in the building.",
            "A stamp seal. You rolled it across wet clay to sign your name."],
    shang: ["The casting is so crisp. Piece-mould, not lost wax.",
            "It's a wine vessel. For the ancestors, not for you."],
    indus: ["We still can't read their script. Not a word of it.",
            "Their cities had drains. Better drains than my street."],
    catal: ["That's a town, seen from above. Eight thousand years ago.",
            "They painted the walls of the rooms they lived in."],
    jomon: ["The eyes. Why are the eyes like that?",
            "Every single one that's ever been found was broken before it was buried. On purpose."],
    cucuteni: ["They burned their own villages down every sixty years and rebuilt them.",
               "The spirals are on everything. Everything."],
    gobekli: ["Hunter-gatherers built that. Before farming. Before pottery.",
              "It's a pillar. There were dozens of them, in a ring."],
    magdalenian: ["That's a wall. Somebody cut a cave wall out and brought it here.",
                  "Seventeen thousand years. Seventeen thousand.",
                  "The animal follows the shape of the rock. They used the bulge for the shoulder."],
    gravettian: ["No face. They never gave them faces.",
                 "There's ochre still in the grooves."],
    neanderthal: ["That's not us. That's a different species, and it made that.",
                  "Hands. They put their hands on the wall too.",
                  "It isn't a tool. It doesn't do anything. They just wanted it to exist."],
    denisovan: ["We know them from a finger bone and a jaw. And this.",
                "Drilled, strung, worn. Someone wore that."],
    unattr_a: ["The card says 'no accepted context'. What does that mean?",
               "Its hands are over its face. They all are.",
               "It hasn't weathered. Look at it. It's been in the ground and it hasn't weathered."],
    unattr_b: ["Eight turns, counterclockwise. It's on everything down there.",
               "Nobody made this. That's what the label is trying not to say.",
               "I've been standing here four minutes. I don't know why."],
    unattr_c: ["The faces aren't modelled underneath the hands. There's nothing there.",
               "Group C. What happened to Group D?",
               "Can we go to the next room. Please."],
    anachronic: ["The depth on that card can't be right.",
                 "That's a wristwatch. From eight hundred metres down.",
                 "Read the accession number. Now read the one on the next case.",
                 "I want to speak to whoever wrote this label."],
  };

  /* ---------- by state of the object ---------------------------------------- */

  const BY_CONDITION = {
    frag: ["There's so little of it left.",
           "You can see about a tenth of what it was.",
           "Half a thing, and it still stops you."],
    poor: ["It's had a rough time.", "The surface has gone almost completely."],
    part: ["Enough of it to know what it was, which is all you need.", ""],
    sound: ["That's basically complete. That's rare.", "Not a chip on it."],
    fine: ["That is in extraordinary condition for its age.",
           "Better preserved than things four thousand years younger."],
    excep: ["That is one of the best of its kind anywhere in the world.",
            "They flew a conservator in for that one.",
            "That's the one on the poster."],
  };

  const BY_RARITY = {
    signif: ["That's the one everyone comes for.",
             "There's a queue for this case at weekends."],
    unique: ["There isn't another one. Anywhere. That's it.",
             "That object is the entire evidence for its own existence.",
             "Three separate universities have asked to borrow that."],
  };

  /* ---------- the deep material --------------------------------------------- */

  const BY_EERIE = [
    [],  /* 0 — nothing to say */
    ["Hang on, how deep did they say that came from?",
     "It's a long way from anywhere it should be.",
     "The layer above it was undisturbed. That's what the card says."],
    ["That's older than I thought people were.",
     "Something made that. It wasn't us.",
     "I don't like this room. It's the light, probably.",
     "Why is it in such good condition."],
    ["The label doesn't say what it is. It says what it isn't.",
     "Unattributed. That means nobody will put their name to a guess.",
     "It's the hands over the faces. That's the bit.",
     "There's no wear on any of them. None of them.",
     "How did they know to bury it in order?"],
    ["That is newer than the ground it was found in and nobody will explain it.",
     "The number on the base is the next one they were going to issue.",
     "I'd like to leave now, if that's alright.",
     "Somebody put these here for us to find. In order. On purpose."],
  ];

  /* ---------- who is speaking ------------------------------------------------ */

  const BY_TYPE = {
    child: ["Is it real?", "Is that a real one?", "Can I touch it?",
            "Why is it broken?", "Who broke it?", "Where's its head?",
            "That one's my favourite.", "Mum. Mum. MUM. Look.",
            "It's smaller than on the sign.", "How did it get in the hole?",
            "Are there bones?", "I want to see the bones."],
    school: ["Miss, do we have to write about this one?",
             "How many more rooms are there?",
             "I'm putting this one in my project.",
             "Sir, is this the oldest thing in the world?",
             "Can we go to the shop after?",
             "That's on the worksheet. That's question four."],
    scholar: ["The attribution is doing a lot of work on that label.",
              "I'd want to see the section drawing before I accepted that date.",
              "This is going to rewrite a chapter. Possibly a book.",
              "Whoever catalogued this was being extremely careful with their words.",
              "The comparanda simply don't exist.",
              "I've read the site report three times. It doesn't explain this."],
    tourist: ["Can you stand next to it? For scale.",
              "No flash. It says no flash.",
              "This is going straight on the internet.",
              "Get the label in the shot as well.",
              "I'm not going to remember any of this without a photo."],
    elder: ["My father would have loved this.",
            "They didn't have any of this when I last came.",
            "Is there somewhere to sit further along?",
            "I've seen the one in the British Museum and this is better."],
    staff: ["Mind the rope, please.",
            "There's a talk on that one at half past.",
            "No, you're fine, you can photograph it — just no flash.",
            "The deep gallery is through the arch and down the steps.",
            "It came out of the ground eleven weeks ago."],
  };

  /* ---------- nothing to do with the art ------------------------------------- */

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
  ];

  /* ---------- assembly -------------------------------------------------------- */

  function fill(line, a) {
    if (!a) return line;
    const cu = S7.cultures.byId[a.cultureId];
    const era = S7.cultures.eraAt(a.depth);
    return line
      .replace(/\{culture\}/g, cu ? cu.short : "unknown")
      .replace(/\{name\}/g, a.name.replace(/,.*$/, "").toLowerCase())
      .replace(/\{material\}/g, S7.artifacts.materialLabel(a.material).toLowerCase())
      .replace(/\{period\}/g, cu ? cu.period : "unknown")
      .replace(/\{era\}/g, era.name.toLowerCase())
      .replace(/\{depth\}/g, Math.round(a.depth) + " m");
  }

  /* Picks a line for a visitor of `type` standing in front of `a`. Buckets are
     weighted so the object in front of them usually wins, but not always —
     a room where everyone is on-topic reads like a script, not a crowd. */
  function forExhibit(rng, a, type) {
    const cu = a ? S7.cultures.byId[a.cultureId] : null;
    const buckets = [];
    const add = (pool, w) => { if (pool && pool.length) buckets.push({ pool, w }); };

    if (a) {
      add(BY_KIND[a.kind], 30);
      if (a.objectType) add(BY_OBJECT[a.objectType], 26);
      add(BY_CULTURE[a.cultureId], 34);
      add(BY_CONDITION[a.condition.id].filter(Boolean), 10);
      add(BY_RARITY[a.rarity.id], 14);
      if (cu) add(BY_EERIE[cu.eerie], cu.eerie * 16);
    }
    add(BY_TYPE[type], type === "adult" ? 0 : 30);
    add(AMBIENT, a ? 8 : 60);

    if (!buckets.length) return fill(rng.pick(AMBIENT), a);
    const b = rng.weighted(buckets, (x) => x.w);
    return fill(rng.pick(b.pool), a);
  }

  const ambient = (rng, type) => {
    const pool = BY_TYPE[type];
    return pool && rng.chance(0.4) ? rng.pick(pool) : rng.pick(AMBIENT);
  };

  const pair = (rng) => rng.pick(PAIRS);

  S7.remarks = {
    forExhibit, ambient, pair,
    BY_KIND, BY_OBJECT, BY_CULTURE, BY_EERIE, BY_TYPE, AMBIENT, PAIRS,
  };
})(window.S7 = window.S7 || {});
