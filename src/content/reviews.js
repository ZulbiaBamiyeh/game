/* ============================================================================
   VISITOR REVIEWS

   Fun, named blurbs for the museum page. Bands track museum rating so a
   empty shed gets MapleStory complaints and a world-class collection gets
   swooning scholars. Picked in a rolling set so "latest" feels alive.
   ============================================================================ */
(function (S7) {
  "use strict";

  const NAMES = [
    "Priya N.", "Marcus T.", "Helen Q.", "Jamal K.", "Sofia R.",
    "Derek \"the Map\" L.", "Auntie June", "Benji O.", "Nadia F.", "Chris W.",
    "Dr. Okonkwo", "Liam P.", "Mei-Lin C.", "Grandad Ron", "Zoe M.",
    "Anon Visitor", "School Party 3B", "K. Ashworth", "Tariq H.", "Ingrid V.",
    "The O'Briens", "Yusuf A.", "Clara B.", "Samir J.", "Ellie F.",
    "Professor Hargreaves", "Riley S.", "Noah G.", "Aisha D.", "Tom from Accounts",
  ];

  /* Each band: rating floor (0–100). First matching band from the top wins. */
  const BANDS = [
    {
      min: 0,
      tag: "Early days",
      lines: [
        "Eh. It was alright. I've seen better sheds.",
        "I could've been at home playing MapleStory.",
        "One room, three things, and a plant. Bold.",
        "The gift shop isn't open. The gift shop of my heart also isn't open.",
        "Came for the archaeology. Left with mild confusion.",
        "Is the point that there isn't a point yet?",
        "My kid asked when the real museum starts. Fair question.",
        "Two stars for the rope barrier. Ambitious rope barrier.",
        "Smelled like damp and ambition. Mostly damp.",
        "I'll come back when there's more than a bottle cap on a plinth.",
        "The admissions desk outnumbered the collection. Respect.",
        "Not bad if you like staring at empty wall and imagining greatness.",
        "Free? I'd still want a discount.",
        "Looked in, nodded, left. The whole visit in three verbs.",
        "Somewhere a regional museum is laughing at us both.",
      ],
    },
    {
      min: 8,
      tag: "Getting there",
      lines: [
        "Okay, there's something here. Still mostly a project, though.",
        "Better than last month. The plant has competition now.",
        "I told my friend it was \"emerging.\" That word does a lot of work.",
        "Cute little collection. Don't quit your day job yet, Institute.",
        "The labels are trying. The objects are trying harder.",
        "Spent twenty minutes. Would spend twenty-two next time.",
        "Not MapleStory, but the plinths have a certain charm.",
        "School party ahead of us. We were the mature ones. Worrying.",
        "I'd bring a date if I wanted them to think I support the arts ironically.",
        "Solid regional afternoon. Tea afterward is the real exhibit.",
        "They've hung more. I'm not saying it's good. I'm saying more.",
        "The rope is still the best-funded thing in the building.",
        "One genuinely interesting piece and eight \"context.\" Classic.",
        "Will tell people it was \"surprisingly okay.\" That's growth.",
        "My mum liked it. My mum likes most things. Calibrate accordingly.",
      ],
    },
    {
      min: 18,
      tag: "Worth a stop",
      lines: [
        "Actually worth the detour. Who knew.",
        "Came for one object, stayed for the next room. Dangerous.",
        "Proper little museum energy. I'm not mad at it.",
        "The sequence of the rooms makes sense. Someone is thinking.",
        "Took photos. Will pretend I understood the labels later.",
        "Kids were quieter than expected. The art was doing work.",
        "I'd put this on a rainy-day list. High praise from me.",
        "Better than the big city place we did last week. Don't @ me.",
        "The café still doesn't exist in my heart, but the walls are filling.",
        "Left wanting to read a book. Mission accomplished, I guess.",
        "Surprisingly atmospheric. The lighting upgrade was money well spent.",
        "Grandad Ron cried at a pot. We don't talk about Grandad Ron.",
        "I'll bring the in-laws. Weaponised culture.",
        "Not world-class. Neighbourhood-class. That's a real tier.",
        "Signed the guestbook \"would shaft again.\" Staff did not laugh.",
      ],
    },
    {
      min: 32,
      tag: "A good afternoon",
      lines: [
        "Spent the whole afternoon. Missed a train. Worth it.",
        "This collection is starting to feel intentional, not lucky.",
        "Every room has a reason to exist. That's rarer than it sounds.",
        "I told three people to go. I don't tell three people anything.",
        "The deep material is starting to show. Goosebumps, professionally.",
        "Gift shop postcard is going on the fridge. Peak endorsement.",
        "Quiet enough to think, busy enough to feel like a place.",
        "My archaeology undergrad is jealous of a public museum. Rude.",
        "Came back for a second visit. The sequence still holds.",
        "Lighting, cases, labels — the boring stuff is excellent. That matters.",
        "I believe the Institute is no longer embarrassed. High bar cleared.",
        "Lost an hour in the dinosaur hall. Found my childhood.",
        "If this is what regional means, the capital can keep its queues.",
        "Left with Understanding, metaphorically. And a pencil, literally.",
        "Would recommend to a friend who pretends not to like museums.",
      ],
    },
    {
      min: 48,
      tag: "Destination",
      lines: [
        "This is a destination museum. Plan the day around it.",
        "I drove two hours. I'd drive three.",
        "The collection has a voice. Not every museum does.",
        "Stood in front of one case for ten minutes. No notes. Just looking.",
        "World-class objects, human-scale building. Perfect combination.",
        "The upper floor earns its stairs. Rare sentence, true here.",
        "I've been to the big nationals. This hits different — and harder.",
        "Scholarly without being cold. Warm without being soft. Balance.",
        "My review is just a list of rooms I need to revisit. All of them.",
        "The café after was a victory lap. The museum did the race.",
        "Told the desk staff thank you like they'd cured something. Maybe they had.",
        "Photography policy? I respected it and still left full.",
        "This is what happens when you don't sell the finds. Keep going.",
        "Brought a sceptic. They're writing their own review. Longer than mine.",
        "Five stars, and I'm not a five-star person.",
      ],
    },
    {
      min: 65,
      tag: "Essential",
      lines: [
        "Essential. Cancel other plans.",
        "I work in museums. I'm taking notes with envy.",
        "The sequence from surface to deep is a masterclass in storytelling.",
        "People fly for less. I'm only slightly joking.",
        "Every tradition on these walls feels earned, not borrowed.",
        "The deep gallery should be illegal for how good it feels.",
        "I cried at a fossil. I am a grown adult with a job.",
        "Best museum experience this year, full stop.",
        "The Institute should be insufferable with pride. Allow it.",
        "Came as a tourist. Left as a pilgrim. Dramatic but accurate.",
        "I've recommended it so many times I've become a local landmark.",
        "The mounted skeletons alone justify the ticket. The rest is grace.",
        "Quiet awe is underrated. This building is full of it.",
        "If you only see one museum this decade, make it this one.",
        "I don't write reviews. I wrote this one. That should tell you.",
      ],
    },
    {
      min: 82,
      tag: "One of a kind",
      lines: [
        "There is nothing else like The Hollow Museum. I've checked.",
        "National treasure. Possibly international. Don't fight me.",
        "I will bore people at dinner parties about this for years.",
        "The collection rewires how you think about time. Casually.",
        "Booked a return ticket before I left the building.",
        "Scholars will cite this place. Civilians will dream about it.",
        "I whispered in the deep gallery. It felt correct.",
        "Five stars is an insult. Invent a sixth.",
        "The whole human record, in order, under one roof. Unreal.",
        "My children will inherit my membership. And my opinions.",
        "I've been to the capitals. This is the one I talk about.",
        "If the Institute never digs again, the museum already won.",
        "A holy site for people who like pots. Respectfully.",
        "Left changed. Annoying when that happens. Grateful.",
        "This isn't a review. It's a thank-you note.",
      ],
    },
  ];

  function bandFor(rating) {
    let best = BANDS[0];
    for (const b of BANDS) if (rating >= b.min) best = b;
    return best;
  }

  /* Stable-ish pick: same day + rating band → same set of reviews, rotates
     as the day and rating move so the board feels alive. */
  function pick(rating, day, count) {
    const band = bandFor(rating || 0);
    const n = Math.max(1, Math.min(count || 4, band.lines.length));
    const seed = ((day || 1) * 17 + Math.floor((rating || 0) * 3) + band.min * 11) >>> 0;
    const out = [];
    const used = new Set();
    for (let i = 0; i < n; i++) {
      let idx = (seed + i * 7) % band.lines.length;
      let guard = 0;
      while (used.has(idx) && guard++ < band.lines.length)
        idx = (idx + 1) % band.lines.length;
      used.add(idx);
      const name = NAMES[(seed + i * 13) % NAMES.length];
      const stars = ratingToStars(rating, i);
      out.push({
        name,
        text: band.lines[idx],
        stars,
        tag: band.tag,
      });
    }
    return out;
  }

  function ratingToStars(rating, jitter) {
    const base = Math.max(1, Math.min(5, Math.round((rating || 0) / 20)));
    /* Mild scatter so not every card is identical. */
    const s = Math.max(1, Math.min(5, base + ((jitter % 3) - 1)));
    return s;
  }

  function starString(n) {
    let out = "";
    for (let i = 1; i <= 5; i++) out += i <= n ? "★" : "☆";
    return out;
  }

  S7.reviews = { pick, bandFor, starString, BANDS, NAMES };
})(window.S7 = window.S7 || {});
