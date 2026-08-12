/* ============================================================================
   LORE

   The intro, the framing, and the closing note. The premise in one line:

     Site 7 is not a site. It is a collection, buried in order, by someone who
     knew who would dig it up.

   Everything the game does mechanically — depth as chronology, one culture per
   band, artifacts that are never sold — falls out of that one idea.
   ============================================================================ */
(function (S7) {
  "use strict";

  const INTRO = [
    {
      html:
        '<div class="inst">Institute for Regional Antiquities</div>' +
        '<p class="bigt">Site 7</p>' +
        '<p class="memo">A field seven miles from anywhere, on land nobody wanted, with no ' +
        'recorded finds in two centuries of ploughing. It is not a prestigious posting. ' +
        'It was assigned to you because the equipment happened to be free.</p>' +
        '<p class="memo">You have a drill, one digger, a shed, and a room in town that the ' +
        'Institute is calling a museum.</p>',
      cta: "Read the terms",
    },
    {
      html:
        '<div class="lbl">Terms of the survey</div>' +
        '<p class="memo">The Institute does not sell material and neither do you. Everything ' +
        'recovered is accessioned, catalogued, and — if it is worth looking at — put on ' +
        'display.</p>' +
        '<p class="memo"><b>The museum is the budget.</b> People pay to come in. At first there ' +
        'will not be many, because at first there is nothing to see. As the collection grows, ' +
        'so does the rating, and so do the visitors, and so does the money you have to spend ' +
        'on getting deeper.</p>' +
        '<p class="memo">Depth costs money. Money comes from the door.</p>',
      cta: "Read the method",
    },
    {
      html:
        '<div class="lbl">A note on method</div>' +
        '<p class="memo">Every object you study teaches the crew something, and it keeps ' +
        'teaching it for the rest of the survey. What it teaches is not up to you — you find ' +
        'out when you lift it.</p>' +
        '<p class="memo">You will also be asked to interpret finds <b>before</b> they are fully ' +
        'exposed. Commit early and a correct reading is worth four times as much Understanding. ' +
        'Commit late and it is worth almost nothing, because by then anyone could have told ' +
        'you.</p>' +
        '<p class="memo">The record keeps whichever answer you gave.</p>',
      cta: "Read the brief",
    },
    {
      html:
        '<div class="lbl">One thing before you start</div>' +
        '<p class="memo">The geophysics came back wrong and was rerun twice. There is between ' +
        'six hundred and nine hundred metres of unconsolidated fill under this field. There is ' +
        'no basin here. There is no fault, no sinkhole, no quarry, no river.</p>' +
        '<p class="memo">Fill that deep does not happen. Somebody put it there.</p>' +
        '<p class="memo">Find out who, and why, and — this is the part the Institute has not ' +
        'asked about — <b>find out what order they put it in.</b></p>',
      cta: "Open the shaft",
    },
  ];

  /* Shown once, when the last keystone is accessioned. */
  const ENDING =
    '<div class="lbl">Closing note, Site 7</div>' +
    '<p class="memo">Eight hundred and twelve metres. The fill stops. Below it is bedrock that ' +
    'has not been disturbed in ninety million years, and set into the top of it, upright, is a ' +
    'survey marker of a pattern this institute adopted in 1974.</p>' +
    '<p class="memo">The deposit above it is in order. Not stratigraphic order — <b>curatorial</b> ' +
    'order. Oldest at the bottom, newest at the top, one tradition per band, the best surviving ' +
    'example of each, packed in voids left deliberately for them. Nothing here settled. ' +
    'Everything here was <b>placed</b>.</p>' +
    '<p class="memo">It is a collection. Somebody assembled the entire material record of our ' +
    'species, in sequence, and buried it in a field where nothing had ever been found, and ' +
    'stamped the bottom of it with the next accession number in our own sequence.</p>' +
    '<p class="memo">They were not hiding it. They were <b>accessioning</b> it. And they knew ' +
    'which institute would be doing the lifting.</p>' +
    '<p class="memo">Site 3 has been reported. The geophysics there came back the same way.</p>';

  /* Small headers shown over the shaft as the drill passes through each band. */
  const ERA_NOTE = {
    overburden: "Ploughsoil and modern refuse",
    industrial: "Bottle glass, cut nails, soot",
    earlymod: "Four continents in one horizon",
    medieval: "One tradition per band, clean boundaries",
    classical: "Nothing in the ground sorts itself like this",
    bronze: "Best surviving example of each. Somebody chose",
    neolithic: "Ten thousand years down, still packed deliberately",
    palaeo: "Cave art does not travel. This did",
    longdark: "Older than art is supposed to be",
    unattr: "No accepted context. None unaccepted either",
    floor: "Sterile fill. It did not settle here",
  };

  /* Rotating status line under the shaft, so the idle screen is never dead. */
  const IDLE_LINES = [
    "Descending", "Cutting", "Logging the section", "Bagging spoil",
    "Recording the face", "Shoring", "Running the sonde",
  ];

  S7.lore = { INTRO, ENDING, ERA_NOTE, IDLE_LINES };
})(window.S7 = window.S7 || {});
