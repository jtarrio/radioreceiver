import "../../src/apps/radioreceiver/help";

/** Builds a table of contents. */
function buildToc() {
  let lvl = 0;
  let toc = document.createElement("UL");
  let elem = document.body.firstElementChild;
  while (elem != null) {
    let thisLvl = elem.tagName == "H1" ? 1 : elem.tagName == "H2" ? 2 : 0;
    if (thisLvl > 0 && !elem.classList.contains("title")) {
      if (lvl > 0 && thisLvl > lvl) {
        let ul = document.createElement("UL");
        toc.lastElementChild?.append(ul);
        toc = ul;
      } else if (thisLvl < lvl) {
        toc = toc.parentElement!;
      }
      let newToc = document.createElement("LI");
      if (elem.id) {
        let a = document.createElement("A") as HTMLAnchorElement;
        a.textContent = elem.textContent;
        a.href = "#" + elem.id;
        newToc.append(a);
      } else {
        newToc.textContent = elem.textContent;
      }
      toc.appendChild(newToc);
      lvl = thisLvl;
    }
    elem = elem.nextElementSibling;
  }
  while (toc.parentElement != null) toc = toc.parentElement;
  if (toc.hasChildNodes()) {
    document.getElementById("toc")?.append(toc);
  }
}

window.addEventListener("load", buildToc);
