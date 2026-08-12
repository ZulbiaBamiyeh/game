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
        '<p class="memo">A LIDAR survey of this field turned up something odd: a patch of loose, ' +
        'buried fill going down a long way, in a spot with no recorded history and nothing on the ' +
        'surface to explain it. That was enough for the Institute to fund a proper dig — and enough ' +
        'to get you the job running it.</p>' +
        '<p class="memo">You have got a drill, one digger, a shed, and a small room in town that is ' +
        'going to be the museum.</p>',
      cta: "How this works",
    },
    {
      html:
        '<div class="lbl">How this works</div>' +
        '<p class="memo">Nothing you dig up gets sold. Everything is catalogued, and if it is worth ' +
        'looking at, it goes on display.</p>' +
        '<p class="memo"><b>The museum pays for the dig.</b> Visitors buy tickets, ticket money buys ' +
        'better equipment, better equipment gets you deeper. There will not be much to see at first, ' +
        'so there will not be many visitors — that changes fast once the collection grows.</p>',
      cta: "One more thing",
    },
    {
      html:
        '<div class="lbl">Reading a find</div>' +
        '<p class="memo">Studying an object teaches your crew something permanent, and you will not ' +
        'know what until you have lifted it.</p>' +
        '<p class="memo">You can also guess what a find is before it is fully uncovered. Guess early ' +
        'and get it right and it is worth a lot more than waiting until it is obvious to everyone.</p>',
      cta: "Almost there",
    },
    {
      html:
        '<div class="lbl">Before you start</div>' +
        '<p class="memo">The survey puts somewhere between six hundred and nine hundred metres of ' +
        'loose fill under this field. That should not be possible — there is no basin here, no ' +
        'fault, no old quarry, nothing that explains ground like that.</p>' +
        '<p class="memo">Someone put it there. Find out who, and why — and keep an eye on the order ' +
        'things come up in. It might matter.</p>',
      cta: "Start digging",
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
    mesozoic: "Dinosaurs. Packed. In a human deposit",
    fossils: "Deep time, carefully boxed",
    minerals: "Cabinet specimens, not river gravel",
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
