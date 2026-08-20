import test from "node:test";
import assert from "node:assert/strict";
import { railwayScope, SOUTHERN_RAILWAY_EDRPOU, REGION } from "../src/config.ts";

const kharkiv = (name: string, edrpou = "99999999") => ({
  entity_edrpou: edrpou,
  entity_name: name,
  region: REGION,
});

test("the Kharkiv branch of Ukrainian Railways is its own scope", () => {
  assert.equal(
    railwayScope({ entity_edrpou: SOUTHERN_RAILWAY_EDRPOU, entity_name: "РФ ПІВДЕННА ЗАЛІЗНИЦЯ", region: REGION }),
    "southern",
  );
});

test("other railway branches are separated from the Kharkiv one", () => {
  assert.equal(
    railwayScope({
      entity_edrpou: "40081347",
      entity_name: 'Філія "Центр забезпечення виробництва" АТ "Укрзалізниця"',
      region: "Київська область",
    }),
    "branch",
  );
});

test("railway organisations registered in the oblast count as local", () => {
  assert.equal(railwayScope(kharkiv("Харківський професійний ліцей залізничного транспорту")), "local");
  assert.equal(railwayScope(kharkiv("Український державний університет залізничного транспорту")), "local");
});

test("a power station is not a railway", () => {
  // An earlier pattern matched "станц" and swept this in.
  assert.equal(railwayScope(kharkiv("Публічне акціонерне товариство «Центренерго» Зміївська теплова електростанція")), null);
  assert.equal(railwayScope(kharkiv("Державна дослідна станція птахівництва")), null);
});

test("a railway-named organisation outside the oblast is not local", () => {
  assert.equal(
    railwayScope({ entity_edrpou: "11111111", entity_name: "Львівський залізничний технікум", region: "Львівська область" }),
    null,
  );
});

test("an ordinary Kharkiv buyer is not railway at all", () => {
  assert.equal(railwayScope(kharkiv("КП Харківські теплові мережі")), null);
});
