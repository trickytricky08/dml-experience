# The DML Experience

Line Rush is a silent browser reflex game. A ticket names an entrée. Press the right packaging, scoop every ingredient on the ticket, then press that same packaging again to close it. Finish the quota before the clock hits 0:00.

Play it at <https://trickytricky08.github.io/dml-experience/>.

## How to play

1. Pick **Easy**, **Normal**, or **Hard** (Normal is the default) and press **Play**.
2. Read the current ticket. The header is the entrée. Chips run packaging, then ingredients, then **Close**.
3. Press the matching packaging first: **Foil** for a burrito, **Bowl** for a burrito bowl or salad, **Container** for tacos or a quesadilla.
4. Scoop the ingredients. Easy and Normal accept them in any order. Hard follows the ticket from left to right.
5. Press the same packaging key to close. The next guest slides in. Clearing the quota ends the round early and banks the leftover seconds.
6. A wrong press flashes red and locks the line. Hit **Trash** to eat the lockout (2.0s / 2.5s / 3.0s) and restart that same ticket. The clock never pauses.

Burritos always include **Soft flour** right after the foil. Tacos always use **Crispy corn**. One scoop per ingredient. Every entrée has a protein; **Veggie** skips the meat and puts guacamole on the ticket. Salad greens and quesadilla cheese are already in the package.

Add `?seed=123` to replay a deal, or `?difficulty=hard` to preselect a tier. Your best score is stored in this browser.

## Key map

| Key | Pan | Key | Pan |
| --- | --- | --- | --- |
| 1 | Foil | Z | Fresh tomato |
| 2 | Bowl | X | Corn |
| 3 | Container | C | Green |
| 4 | Soft flour | V | Red |
| 5 | Crispy corn | B | Sour cream |
| Q | White rice | N | Cheese |
| W | Brown rice | M | Guac |
| E | Black beans | J | Queso |
| R | Pinto beans | K | Lettuce |
| A | Chicken | L | Honey vinaigrette |
| S | Steak | T | Brisket (LTO) |
| D | Barbacoa | H | Fajitas |
| F | Carnitas | Backspace | Trash |
| G | Sofritas | | |

On a phone, tap the packaging bar, the shells, the pans, and Trash. Keys appear after a keyboard is used.

## Config

Durations, quotas, scoop ranges, lockout, scoring, and the key map all live in [`js/config.js`](js/config.js). A round only stores constraints. [`js/tickets.js`](js/tickets.js) deals a fresh legal ticket inside those bounds.

## Tests

```bash
npm install
npm test
npm run e2e
```

`npm test` checks the generator and the rules engine with `node --test`. `npm run e2e` plays a full Normal run in headless Chrome at 1280×800 (keyboard) and 390×844 (tap), and triggers each mistake.
