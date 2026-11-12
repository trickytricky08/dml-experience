# The DML Experience

Line Rush is a silent browser reflex game. A ticket names an entrée. Press the right packaging, scoop every ingredient on the ticket, then press Wrap. Finish the quota before the clock hits 0:00.

Play it at <https://trickytricky08.github.io/dml-experience/>.

## How to play

1. Pick **Easy**, **Normal**, or **Hard** (Normal is the default) and press **Play**.
2. Read the current ticket. The header is the entrée. Chips run packaging, then ingredients, then **Wrap**.
3. Press the matching packaging first: **Foil** for a burrito, **Bowl** for a burrito bowl or salad, **Container** for tacos or a quesadilla. Pressing it again does not seal the entrée.
4. Scoop the ingredients. Easy and Normal accept them in any order. Hard follows the ticket from left to right. Easy also shows a dashed hint of the next scoop; Normal and Hard do not.
5. Press **Wrap** (Enter) when every ingredient is in. The next guest slides in. Clearing the quota ends the round early and banks the leftover seconds. If the clock hits 0:00 before the quota, the run ends.
6. A wrong press, including an early Wrap, flashes red, locks the line, and immediately drops time off the round clock (2.0s Easy, 2.5s Normal, 3.0s Hard). Hit **Trash** to restart that ticket. Trash is instant, and trashing a clean ticket costs nothing. If the deduction hits 0:00, the round fails. **Home** or Esc asks before quitting; the clock pauses only while that question is up, and quitting does not save a best.

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
| G | Sofritas | Enter | Wrap |
| | | Esc | Home |

On a phone, tap the packaging bar, the shells, the pans, Wrap, and Trash. Keys appear after a keyboard is used.

## Config

Durations, quotas, scoop ranges, mistake penalties, scoring, the key map, and `showNextHint` all live in [`js/config.js`](js/config.js). Easy sets `showNextHint`; Normal and Hard do not. `mistakePenaltyMs` is 2000, 2500, and 3000. A round only stores constraints. [`js/tickets.js`](js/tickets.js) deals a fresh legal ticket inside those bounds. The last chip on every ticket is **Wrap**.

## Tests

```bash
npm install
npm test
npm run e2e
```

`npm test` checks the generator, the rules engine, and the round/Home flow with `node --test`. `npm run e2e` plays a full Normal run in headless Chrome at 1280×800 (keyboard) and 390×844 (tap), triggers each mistake including an early Wrap, quits from Home both ways, and lets a round time out into game over.
