# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> premade buy buttons route to on-domain checkout
- Location: tests/e2e/smoke.spec.ts:65:5

# Error details

```
TimeoutError: page.goto: Timeout 45000ms exceeded.
Call log:
  - navigating to "http://localhost:3000/premade/", waiting until "load"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Skip to content" [ref=e2] [cursor=pointer]:
    - /url: "#main"
  - generic:
    - generic: "[ 01 ]"
  - banner [ref=e3]:
    - generic [ref=e4]:
      - link "GHL Video home" [ref=e6] [cursor=pointer]:
        - /url: /
        - img "GHL Video" [ref=e8]
      - navigation "Main" [ref=e9]:
        - button "Services" [ref=e11]:
          - generic [ref=e12]:
            - generic [ref=e13]: "["
            - generic [ref=e14]: Services
            - generic [ref=e15]: "]"
          - img [ref=e16]
        - link "Our Work" [ref=e18] [cursor=pointer]:
          - /url: /work/
          - generic [ref=e19]:
            - generic [ref=e20]: "["
            - generic [ref=e21]: Our Work
            - generic [ref=e22]: "]"
        - link "About Us" [ref=e23] [cursor=pointer]:
          - /url: /about/
          - generic [ref=e24]:
            - generic [ref=e25]: "["
            - generic [ref=e26]: About Us
            - generic [ref=e27]: "]"
        - link "Free Resources" [ref=e28] [cursor=pointer]:
          - /url: /resources/
          - generic [ref=e29]:
            - generic [ref=e30]: "["
            - generic [ref=e31]: Free Resources
            - generic [ref=e32]: "]"
        - link "Knowledge Hub" [ref=e33] [cursor=pointer]:
          - /url: /blog/
          - generic [ref=e34]:
            - generic [ref=e35]: "["
            - generic [ref=e36]: Knowledge Hub
            - generic [ref=e37]: "]"
      - link "Book a Call" [ref=e40] [cursor=pointer]:
        - /url: /contact/
        - text: Book a Call
        - generic [ref=e41]: →
  - main [ref=e42]:
    - generic [ref=e44]:
      - generic [ref=e46]:
        - img [ref=e47]
        - generic [ref=e52]: Premade Videos
      - heading "Branded HighLevel videos, ready when you are." [level=1] [ref=e53]
      - paragraph [ref=e54]: Browse the full library. Order any video on its own, or take a pack and save. Every one is white-labeled to your SaaS.
      - generic [ref=e55]:
        - link "See the videos" [ref=e56] [cursor=pointer]:
          - /url: "#videos"
          - text: See the videos
          - generic [ref=e57]: →
        - link "Book a Call" [ref=e58] [cursor=pointer]:
          - /url: /contact/
          - text: Book a Call
          - generic [ref=e59]: →
    - paragraph [ref=e70]: "[ Trusted by ]"
    - generic [ref=e75]:
      - region "The video library" [ref=e76]:
        - generic [ref=e77]:
          - generic [ref=e79]:
            - generic [ref=e80]:
              - img [ref=e81]
              - generic [ref=e86]: The library
            - heading "Every video and pack, in one place." [level=2] [ref=e87]
            - paragraph [ref=e88]: 800+ HighLevel teams order from this library. Filter it on the left, open a pack to browse it as a playlist, and preview anything before you order.
          - generic [ref=e90]:
            - tablist "Catalog view" [ref=e91]:
              - tab "All New Videos 5" [selected] [ref=e92]:
                - generic [ref=e93]: "["
                - generic [ref=e94]: All New Videos
                - generic [ref=e95]: "5"
                - generic [ref=e96]: "]"
              - tab "AI First SaaS Pack 9" [ref=e97]:
                - generic [ref=e98]: "["
                - generic [ref=e99]: AI First SaaS Pack
                - generic [ref=e100]: "9"
                - generic [ref=e101]: "]"
              - tab "Complete Video Stack 53" [ref=e102]:
                - generic [ref=e103]: "["
                - generic [ref=e104]: Complete Video Stack
                - generic [ref=e105]: "53"
                - generic [ref=e106]: "]"
              - tab "HighLevel x GHL Video" [ref=e107]:
                - generic [ref=e108]: "["
                - generic [ref=e109]: HighLevel x GHL Video
                - generic [ref=e110]: "]"
              - tab "Feature Animations 23" [ref=e111]:
                - generic [ref=e112]: "["
                - generic [ref=e113]: Feature Animations
                - generic [ref=e114]: "23"
                - generic [ref=e115]: "]"
              - tab "Classic Library 56" [ref=e116]:
                - generic [ref=e117]: "["
                - generic [ref=e118]: Classic Library
                - generic [ref=e119]: "56"
                - generic [ref=e120]: "]"
            - generic [ref=e124]:
              - complementary [ref=e125]:
                - generic [ref=e126]:
                  - paragraph [ref=e127]: "[ Video type ]"
                  - list [ref=e128]:
                    - listitem [ref=e129]:
                      - button "Any 5" [pressed] [ref=e130]:
                        - generic [ref=e132]: Any
                        - generic [ref=e133]: "5"
                    - listitem [ref=e134]:
                      - button "Explainer 2" [ref=e135]:
                        - generic [ref=e137]: Explainer
                        - generic [ref=e138]: "2"
                    - listitem [ref=e139]:
                      - button "Feature Explainer 3" [ref=e140]:
                        - generic [ref=e142]: Feature Explainer
                        - generic [ref=e143]: "3"
                - generic [ref=e144]:
                  - paragraph [ref=e145]: "[ Capability ]"
                  - list [ref=e146]:
                    - listitem [ref=e147]:
                      - button "Any 5" [pressed] [ref=e148]:
                        - generic [ref=e150]: Any
                        - generic [ref=e151]: "5"
                    - listitem [ref=e152]:
                      - button "All-in-one 1" [ref=e153]:
                        - generic [ref=e155]: All-in-one
                        - generic [ref=e156]: "1"
                    - listitem [ref=e157]:
                      - button "AI Receptionist 1" [ref=e158]:
                        - generic [ref=e160]: AI Receptionist
                        - generic [ref=e161]: "1"
                    - listitem [ref=e162]:
                      - button "Unified Inbox 1" [ref=e163]:
                        - generic [ref=e165]: Unified Inbox
                        - generic [ref=e166]: "1"
                    - listitem [ref=e167]:
                      - button "Reputation & Reviews 1" [ref=e168]:
                        - generic [ref=e170]: Reputation & Reviews
                        - generic [ref=e171]: "1"
                    - listitem [ref=e172]:
                      - button "Full platform overview 1" [ref=e173]:
                        - generic [ref=e175]: Full platform overview
                        - generic [ref=e176]: "1"
              - generic [ref=e177]:
                - paragraph [ref=e179]: 5 videos
                - generic [ref=e181]:
                  - generic [ref=e183]:
                    - generic [ref=e184]:
                      - figure "Explainer / All-in-one" [ref=e185]:
                        - generic:
                          - text: Explainer
                          - generic: / All-in-one
                        - generic:
                          - img
                      - 'button "Preview: All-in-one + AI-First Positioning" [ref=e191] [cursor=pointer]'
                    - generic [ref=e193]:
                      - generic [ref=e194]:
                        - paragraph [ref=e195]: EXP-001
                        - heading "All-in-one + AI-First Positioning" [level=3] [ref=e196]
                      - generic [ref=e197]:
                        - generic [ref=e198]: $495
                        - link "Order Now" [ref=e199] [cursor=pointer]:
                          - /url: /checkout/exp-001/
                          - text: Order Now
                          - generic [ref=e200]: →
                  - generic [ref=e202]:
                    - generic [ref=e203]:
                      - figure "Feature Explainer / AI Receptionist" [ref=e204]:
                        - generic:
                          - text: Feature Explainer
                          - generic: / AI Receptionist
                        - generic:
                          - img
                      - 'button "Preview: AI Receptionist + Conversational AI" [ref=e210] [cursor=pointer]'
                    - generic [ref=e212]:
                      - generic [ref=e213]:
                        - paragraph [ref=e214]: SHORT-001
                        - heading "AI Receptionist + Conversational AI" [level=3] [ref=e215]
                      - generic [ref=e216]:
                        - generic [ref=e217]: $495
                        - link "Order Now" [ref=e218] [cursor=pointer]:
                          - /url: /checkout/short-001/
                          - text: Order Now
                          - generic [ref=e219]: →
                  - generic [ref=e221]:
                    - generic [ref=e222]:
                      - figure "Feature Explainer / Unified Inbox" [ref=e223]:
                        - generic:
                          - text: Feature Explainer
                          - generic: / Unified Inbox
                        - generic:
                          - img
                      - 'button "Preview: Unified Inbox + Conversational AI" [ref=e229] [cursor=pointer]'
                    - generic [ref=e231]:
                      - generic [ref=e232]:
                        - paragraph [ref=e233]: SHORT-002
                        - heading "Unified Inbox + Conversational AI" [level=3] [ref=e234]
                      - generic [ref=e235]:
                        - generic [ref=e236]: $495
                        - link "Order Now" [ref=e237] [cursor=pointer]:
                          - /url: /checkout/short-002/
                          - text: Order Now
                          - generic [ref=e238]: →
                  - generic [ref=e240]:
                    - generic [ref=e241]:
                      - figure "Feature Explainer / Reputation & Reviews" [ref=e242]:
                        - generic:
                          - text: Feature Explainer
                          - generic: / Reputation & Reviews
                        - generic:
                          - img
                      - 'button "Preview: Reputation Management + Reviews AI" [ref=e248] [cursor=pointer]'
                    - generic [ref=e250]:
                      - generic [ref=e251]:
                        - paragraph [ref=e252]: SHORT-003
                        - heading "Reputation Management + Reviews AI" [level=3] [ref=e253]
                      - generic [ref=e254]:
                        - generic [ref=e255]: $495
                        - link "Order Now" [ref=e256] [cursor=pointer]:
                          - /url: /checkout/short-003/
                          - text: Order Now
                          - generic [ref=e257]: →
                  - generic [ref=e259]:
                    - generic [ref=e260]:
                      - figure "Explainer / Full platform overview" [ref=e261]:
                        - generic:
                          - text: Explainer
                          - generic: / Full platform overview
                        - generic:
                          - img
                      - 'button "Preview: HighLevel''s Official Full Platform Pitch" [ref=e267] [cursor=pointer]'
                    - generic [ref=e269]:
                      - generic [ref=e270]:
                        - paragraph [ref=e271]: EXP-002
                        - heading "HighLevel's Official Full Platform Pitch" [level=3] [ref=e272]
                      - generic [ref=e273]:
                        - generic [ref=e274]: $495
                        - link "Order Now" [ref=e275] [cursor=pointer]:
                          - /url: /checkout/exp-002/
                          - text: Order Now
                          - generic [ref=e276]: →
      - region "Video bundles" [ref=e277]:
        - generic [ref=e278]:
          - generic [ref=e280]:
            - generic [ref=e281]:
              - img [ref=e282]
              - generic [ref=e287]: Bundle and save
            - heading "Bundle up and save more." [level=2] [ref=e288]
            - paragraph [ref=e289]: "Three ways to bundle: our newest releases, the classic library at reduced prices, or a mix of both. Every video white-labeled to your SaaS."
          - generic [ref=e291]:
            - tablist "Bundle type" [ref=e292]:
              - tab "New Video Bundle" [selected] [ref=e293]
              - tab "Classic Library Bundle" [ref=e294]
              - tab "Mix Bundle" [ref=e295]
            - generic [ref=e296]:
              - paragraph [ref=e297]: Only our newest releases. Small and high-value for now; it grows as the new library does.
              - generic [ref=e298]:
                - generic [ref=e299]:
                  - heading "Essential" [level=3] [ref=e300]
                  - generic [ref=e301]:
                    - generic [ref=e302]: $995
                    - generic [ref=e303]: $1,380
                    - generic [ref=e304]: save 28%
                  - list [ref=e305]:
                    - listitem [ref=e306]:
                      - img [ref=e307]
                      - generic [ref=e309]: 1× Explainer
                    - listitem [ref=e310]:
                      - img [ref=e311]
                      - generic [ref=e313]: 2× Short Explainer
                    - listitem [ref=e314]:
                      - img [ref=e315]
                      - generic [ref=e317]: Full Platform Pitch
                  - paragraph [ref=e318]: Delivery in 7 days
                  - link "Order Now" [ref=e319] [cursor=pointer]:
                    - /url: /checkout/pack-003/
                    - text: Order Now
                    - generic [ref=e320]: →
                - generic [ref=e321]:
                  - generic [ref=e322]: Most popular
                  - heading "Growth" [level=3] [ref=e323]
                  - generic [ref=e324]:
                    - generic [ref=e325]: $1,495
                    - generic [ref=e326]: $2,265
                    - generic [ref=e327]: save 34%
                  - list [ref=e328]:
                    - listitem [ref=e329]:
                      - img [ref=e330]
                      - generic [ref=e332]: 1× Explainer
                    - listitem [ref=e333]:
                      - img [ref=e334]
                      - generic [ref=e336]: 4× Short Explainer
                    - listitem [ref=e337]:
                      - img [ref=e338]
                      - generic [ref=e340]: 1× Demo
                    - listitem [ref=e341]:
                      - img [ref=e342]
                      - generic [ref=e344]: Full Platform Pitch
                  - paragraph [ref=e345]: Delivery in 10 days
                  - link "Order Now" [ref=e346] [cursor=pointer]:
                    - /url: /checkout/pack-004/
                    - text: Order Now
                    - generic [ref=e347]: →
      - generic [ref=e350]:
        - generic [ref=e354]:
          - generic [ref=e355]:
            - img [ref=e356]
            - generic [ref=e361]: What is included
          - heading "Every video ships white-label." [level=2] [ref=e362]
        - list [ref=e365]:
          - listitem [ref=e366]:
            - img [ref=e367]
            - paragraph [ref=e369]: Your logo and brand colors on every frame
          - listitem [ref=e370]:
            - img [ref=e371]
            - paragraph [ref=e373]: Your dashboard theme and platform screens
          - listitem [ref=e374]:
            - img [ref=e375]
            - paragraph [ref=e377]: Professional voiceover in your choice of accent
          - listitem [ref=e378]:
            - img [ref=e379]
            - paragraph [ref=e381]: Brand-agnostic scripts, no competitor named
          - listitem [ref=e382]:
            - img [ref=e383]
            - paragraph [ref=e385]: Full commercial rights, no attribution
      - generic [ref=e388]:
        - generic [ref=e389]:
          - generic [ref=e390]:
            - img [ref=e391]
            - generic [ref=e396]: How it works
          - heading "Order today, publish this week." [level=2] [ref=e397]
          - paragraph [ref=e398]: Pick a video, send your brand kit, and publish. The whole process runs from your order page, and most videos land in 5 to 7 days.
          - link "See the videos" [ref=e400] [cursor=pointer]:
            - /url: "#videos"
            - text: See the videos
            - generic [ref=e401]: →
          - figure "Watch how it works" [ref=e403]:
            - generic: Watch how it works
            - 'button "Play: Watch how it works" [ref=e409] [cursor=pointer]'
            - generic:
              - img
        - list [ref=e411]:
          - listitem [ref=e412]:
            - img [ref=e415]
            - generic [ref=e421]:
              - paragraph [ref=e422]: Step / 01
              - heading "Order" [level=3] [ref=e423]
              - paragraph [ref=e424]: Pick a single video or a full pack and check out. No call required.
          - listitem [ref=e425]:
            - img [ref=e428]
            - generic [ref=e434]:
              - paragraph [ref=e435]: Step / 02
              - heading "Send your brand kit" [level=3] [ref=e436]
              - paragraph [ref=e437]: Logo, colors, dashboard screens, and voiceover preference through the intake form.
          - listitem [ref=e438]:
            - img [ref=e441]
            - generic [ref=e446]:
              - paragraph [ref=e447]: Step / 03
              - heading "Receive and publish" [level=3] [ref=e448]
              - paragraph [ref=e449]: We white-label every video to your SaaS and deliver after a full review round.
    - generic [ref=e452]:
      - generic [ref=e456]:
        - generic [ref=e457]:
          - img [ref=e458]
          - generic [ref=e463]: Keep going
        - heading "Need something premade cannot do?" [level=2] [ref=e464]
      - generic [ref=e465]:
        - link "Custom Production Bespoke scripts, your positioning, built from scratch. See custom production" [ref=e467] [cursor=pointer]:
          - /url: /custom-video/
          - generic [ref=e468]:
            - paragraph [ref=e469]: Custom Production
            - img [ref=e471]
          - paragraph [ref=e476]: Bespoke scripts, your positioning, built from scratch.
          - paragraph [ref=e477]:
            - text: See custom production
            - generic [ref=e478]: →
        - link "Video Editing Publishing weekly? Put an editor on a monthly plan. See video editing" [ref=e480] [cursor=pointer]:
          - /url: /editing/
          - generic [ref=e481]:
            - paragraph [ref=e482]: Video Editing
            - img [ref=e484]
          - paragraph [ref=e490]: Publishing weekly? Put an editor on a monthly plan.
          - paragraph [ref=e491]:
            - text: See video editing
            - generic [ref=e492]: →
    - generic [ref=e494]:
      - generic [ref=e496]:
        - generic [ref=e497]:
          - generic [ref=e498]: 800+
          - generic [ref=e499]: HighLevel SaaS teams
        - link "5.0 client rating on Google" [ref=e501] [cursor=pointer]:
          - /url: https://www.google.com/search?q=ghl+video#lrd=0x3755c3a3394f03b9:0x1f310bcbd31aa084,1
          - generic [ref=e502]: "5.0"
          - generic [ref=e503]: client rating on Google
        - generic [ref=e505]: "\"Great quality and quick turnaround! Will definitely work with again!\" Ryan Maule, Google review"
      - generic [ref=e508]:
        - generic [ref=e509]:
          - img [ref=e510]
          - generic [ref=e515]: FAQ
        - heading "Asked before every order." [level=2] [ref=e516]
      - generic [ref=e519]:
        - group [ref=e520]:
          - generic "01 Is the video really mine to use anywhere?" [ref=e521] [cursor=pointer]:
            - generic [ref=e522]: "01"
            - generic [ref=e523]: Is the video really mine to use anywhere?
            - img [ref=e525]
        - group [ref=e527]:
          - generic "02 How custom does each video get?" [ref=e528] [cursor=pointer]:
            - generic [ref=e529]: "02"
            - generic [ref=e530]: How custom does each video get?
            - img [ref=e532]
        - group [ref=e534]:
          - generic "03 Some videos say coming soon. What does that mean?" [ref=e535] [cursor=pointer]:
            - generic [ref=e536]: "03"
            - generic [ref=e537]: Some videos say coming soon. What does that mean?
            - img [ref=e539]
        - group [ref=e541]:
          - generic "04 What if I need a different script or format?" [ref=e542] [cursor=pointer]:
            - generic [ref=e543]: "04"
            - generic [ref=e544]: What if I need a different script or format?
            - img [ref=e546]
        - group [ref=e548]:
          - generic "05 How do I send my branding?" [ref=e549] [cursor=pointer]:
            - generic [ref=e550]: "05"
            - generic [ref=e551]: How do I send my branding?
            - img [ref=e553]
      - generic [ref=e556]:
        - paragraph [ref=e557]: The call answers the rest.
        - link "Book a Call" [ref=e559] [cursor=pointer]:
          - /url: /contact/
          - text: Book a Call
          - generic [ref=e560]: →
  - contentinfo [ref=e561]:
    - generic [ref=e562]:
      - generic [ref=e563]:
        - img "GHL Video" [ref=e565]
        - paragraph [ref=e566]: Video built for HighLevel SaaS. Fast, custom, done.
        - paragraph [ref=e567]: A brand of Vidiosa LLC
      - generic [ref=e568]:
        - heading "Services" [level=3] [ref=e569]
        - list [ref=e570]:
          - listitem [ref=e571]:
            - link "Premade Videos" [ref=e572] [cursor=pointer]:
              - /url: /premade/
          - listitem [ref=e573]:
            - link "Custom Production" [ref=e574] [cursor=pointer]:
              - /url: /custom-video/
          - listitem [ref=e575]:
            - link "Video Editing" [ref=e576] [cursor=pointer]:
              - /url: /editing/
      - generic [ref=e577]:
        - heading "Explore" [level=3] [ref=e578]
        - list [ref=e579]:
          - listitem [ref=e580]:
            - link "Our Work" [ref=e581] [cursor=pointer]:
              - /url: /work/
          - listitem [ref=e582]:
            - link "About Us" [ref=e583] [cursor=pointer]:
              - /url: /about/
          - listitem [ref=e584]:
            - link "Free Resources" [ref=e585] [cursor=pointer]:
              - /url: /resources/
          - listitem [ref=e586]:
            - link "Knowledge Hub" [ref=e587] [cursor=pointer]:
              - /url: /blog/
      - generic [ref=e588]:
        - heading "Company" [level=3] [ref=e589]
        - list [ref=e590]:
          - listitem [ref=e591]:
            - link "About" [ref=e592] [cursor=pointer]:
              - /url: /about/
          - listitem [ref=e593]:
            - link "Contact" [ref=e594] [cursor=pointer]:
              - /url: /contact/
          - listitem [ref=e595]:
            - link "Book a Call" [ref=e596] [cursor=pointer]:
              - /url: /contact/
          - listitem [ref=e597]:
            - link "Request a Quote" [ref=e598] [cursor=pointer]:
              - /url: /quote/
      - generic [ref=e599]:
        - heading "Our Other Brands" [level=3] [ref=e600]
        - list [ref=e601]:
          - listitem [ref=e602]:
            - link "growX growx.studio" [ref=e603] [cursor=pointer]:
              - /url: https://growx.studio
              - text: growX
              - generic [ref=e604]: growx.studio
          - listitem [ref=e605]:
            - link "socialX socialx.studio" [ref=e606] [cursor=pointer]:
              - /url: https://socialx.studio
              - text: socialX
              - generic [ref=e607]: socialx.studio
    - generic [ref=e609]:
      - link "hi@ghlvideo.com" [ref=e610] [cursor=pointer]:
        - /url: mailto:hi@ghlvideo.com
      - generic [ref=e611]:
        - link "Privacy" [ref=e612] [cursor=pointer]:
          - /url: /legal/privacy/
        - link "Terms" [ref=e613] [cursor=pointer]:
          - /url: /legal/terms/
        - link "Refund" [ref=e614] [cursor=pointer]:
          - /url: /legal/refund/
      - paragraph [ref=e615]: GHL Video is not affiliated with or endorsed by GoHighLevel Inc.
    - generic [ref=e617]:
      - generic [ref=e618]:
        - generic [ref=e619]: +
        - generic [ref=e620]: +
        - generic [ref=e621]: +
        - generic [ref=e622]: +
        - img
      - generic [ref=e623]:
        - link "GHL Video on YouTube" [ref=e624] [cursor=pointer]:
          - /url: https://www.youtube.com/@ghlvideo_white-labeled
          - img [ref=e625]
          - generic [ref=e627]: YouTube
        - link "GHL Video on Facebook" [ref=e628] [cursor=pointer]:
          - /url: https://www.facebook.com/ghlvideo
          - img [ref=e629]
          - generic [ref=e631]: Facebook
        - link "GHL Video on Instagram" [ref=e632] [cursor=pointer]:
          - /url: https://www.instagram.com/ghlvideo
          - img [ref=e633]
          - generic [ref=e635]: Instagram
        - link "GHL Video on LinkedIn" [ref=e636] [cursor=pointer]:
          - /url: "#"
          - img [ref=e637]
          - generic [ref=e639]: LinkedIn
  - generic [ref=e640]:
    - generic [ref=e642] [cursor=pointer]:
      - img "Avatar" [ref=e643]
      - generic [ref=e644]: Hi there, have a question? Text us here.
      - button "Close prompt" [ref=e645]:
        - img [ref=e646]
    - button "Select to open the chat widget" [ref=e648] [cursor=pointer]:
      - img [ref=e650]
  - generic [ref=e656] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e657]:
      - img [ref=e658]
    - generic [ref=e661]:
      - button "Open issues overlay" [ref=e662]:
        - generic [ref=e663]:
          - generic [ref=e664]: "0"
          - generic [ref=e665]: "1"
        - generic [ref=e666]: Issue
      - button "Collapse issues badge" [ref=e667]:
        - img [ref=e668]
  - alert [ref=e670]
```

# Test source

```ts
  1   | import { test, expect, type Page } from "@playwright/test";
  2   | 
  3   | /*
  4   |  * Read-only smoke: every marketing page renders, carries its chrome, and
  5   |  * throws no console errors. No checkout page is visited (loading one
  6   |  * creates a real PaymentIntent) and nothing is submitted.
  7   |  */
  8   | 
  9   | const PAGES: { path: string; h1?: RegExp }[] = [
  10  |   { path: "/" },
  11  |   { path: "/premade/" },
  12  |   { path: "/custom-video/" },
  13  |   { path: "/editing/" },
  14  |   { path: "/quote/" },
  15  |   { path: "/about/" },
  16  |   { path: "/contact/" },
  17  |   { path: "/work/" },
  18  |   { path: "/highlevel-demo-video/" },
  19  |   { path: "/highlevel-video-bundle/" },
  20  |   { path: "/blog/" },
  21  |   { path: "/resources/" },
  22  |   { path: "/legal/privacy/" },
  23  |   { path: "/legal/terms/" },
  24  |   { path: "/legal/refund/" },
  25  | ];
  26  | 
  27  | /* Known third-party noise, allowed by exact signature only. The LeadConnector
  28  |  * chat widget stamps mode="md" onto <html> before React hydrates, which
  29  |  * React 19 reports as a hydration attribute mismatch. Harmless, outside our
  30  |  * code, timing-dependent. Everything else stays a failure. */
  31  | const ALLOWED_ERRORS = [/mode="md"/];
  32  | 
  33  | function collectConsoleErrors(page: Page): string[] {
  34  |   const errors: string[] = [];
  35  |   const push = (text: string) => {
  36  |     if (!ALLOWED_ERRORS.some((re) => re.test(text))) errors.push(text);
  37  |   };
  38  |   page.on("console", (msg) => {
  39  |     if (msg.type() === "error") push(msg.text());
  40  |   });
  41  |   page.on("pageerror", (err) => push(String(err)));
  42  |   return errors;
  43  | }
  44  | 
  45  | for (const { path } of PAGES) {
  46  |   test(`${path} renders clean`, async ({ page }) => {
  47  |     const errors = collectConsoleErrors(page);
  48  |     const res = await page.goto(path);
  49  |     expect(res?.status(), `${path} should respond 200`).toBe(200);
  50  |     await expect(page.locator("h1").first()).toBeVisible();
  51  |     await expect(page).toHaveTitle(/GHL Video/);
  52  |     expect(errors, `console errors on ${path}`).toEqual([]);
  53  |   });
  54  | }
  55  | 
  56  | test("header nav and footer chrome are present on the homepage", async ({ page }) => {
  57  |   await page.goto("/");
  58  |   await expect(page.getByRole("link", { name: "Book a Call" }).first()).toBeVisible();
  59  |   // testimonial cards also use <footer>; the page footer is the contentinfo
  60  |   const footer = page.getByRole("contentinfo");
  61  |   await expect(footer).toContainText("A brand of Vidiosa LLC");
  62  |   await expect(footer).toContainText("not affiliated with or endorsed by");
  63  | });
  64  | 
  65  | test("premade buy buttons route to on-domain checkout", async ({ page }) => {
> 66  |   await page.goto("/premade/");
      |              ^ TimeoutError: page.goto: Timeout 45000ms exceeded.
  67  |   const orderLinks = page.locator('a[href^="/checkout/"]');
  68  |   expect(await orderLinks.count()).toBeGreaterThan(0);
  69  |   const hrefs = await orderLinks.evaluateAll((as) =>
  70  |     as.map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? ""),
  71  |   );
  72  |   for (const href of hrefs) expect(href).toMatch(/^\/checkout\/[a-z0-9-]+\/?$/);
  73  |   // the external order site is retired: no buy link may point there
  74  |   expect(await page.locator('a[href*="order.ghlvideo.com"]').count()).toBe(0);
  75  | });
  76  | 
  77  | test("editing plans link their subscription skus", async ({ page }) => {
  78  |   await page.goto("/editing/");
  79  |   for (const sku of ["editing-starter", "editing-growth", "editing-scale"]) {
  80  |     await expect(page.locator(`a[href^="/checkout/${sku}"]`).first()).toBeAttached();
  81  |   }
  82  | });
  83  | 
  84  | test("sitemap and robots respond", async ({ request }) => {
  85  |   const sitemap = await request.get("/sitemap.xml");
  86  |   expect(sitemap.status()).toBe(200);
  87  |   expect(await sitemap.text()).toContain("ghlvideo.com");
  88  |   const robots = await request.get("/robots.txt");
  89  |   expect(robots.status()).toBe(200);
  90  |   expect(await robots.text()).toContain("Disallow: /admin/");
  91  | });
  92  | 
  93  | test("stub pages are noindex", async ({ page }) => {
  94  |   for (const path of ["/blog/", "/resources/"]) {
  95  |     await page.goto(path);
  96  |     const robots = page.locator('meta[name="robots"]');
  97  |     await expect(robots).toHaveAttribute("content", /noindex/);
  98  |   }
  99  | });
  100 | 
```