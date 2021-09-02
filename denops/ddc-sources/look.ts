import { BaseSource, Candidate } from "https://deno.land/x/ddc_vim/types.ts#^";
import { GatherCandidatesArguments } from "https://deno.land/x/ddc_vim/base/source.ts";
import { assertEquals } from "https://deno.land/std/testing/asserts.ts";

async function run(cmd: string[]): Promise<string> {
  const p = Deno.run({ cmd, stdout: "piped", stderr: "null", stdin: "null" });
  await p.status();
  return new TextDecoder().decode(await p.output());
}

function isLower(c: string): boolean {
  return /^[a-z]$/g.test(c);
}

function isUpper(c: string): boolean {
  return /^[A-Z]$/g.test(c);
}

type Case = {
  // -1: lower eng alph, 0: others, 1: upper eng alph
  v: number;
  n: number;
};

function conv(series: Case[], word: string): string {
  let ret = "";
  let offset = 0;
  for (const s of series) {
    const target = word.slice(offset, s.n);
    ret += s.v < 0
      ? target.toLowerCase()
      : s.v > 0
      ? target.toUpperCase()
      : target;
    offset += s.n;
  }
  ret += word.slice(offset);
  return ret;
}

function unique<T>(xs: T[]): T[] {
  const pool = new Set();
  const ret = [];
  for (const x of xs) {
    if (pool.has(x)) continue;
    ret.push(x);
    pool.add(x);
  }
  return ret;
}

function convert(query: string, words: string[]): string[] {
  const flg = query.split("").map((c) => isLower(c) ? -1 : isUpper(c) ? 1 : 0);
  const series = flg.reduce((a: Case[], b) => {
    if (!a.length) return [{ v: b, n: 1 }];
    const last = a.slice(-1)[0];
    if (last.v == b) {
      last.n++;
      return a;
    } else {
      a.push({ v: b, n: 1 });
      return a;
    }
  }, []);
  return unique(words.map((w) => conv(series, w)));
}

type Params = {
  convertCase: boolean;
};

export class Source extends BaseSource {
  async gatherCandidates({
    sourceParams,
    completeStr,
  }: GatherCandidatesArguments): Promise<Candidate[]> {
    const p = sourceParams as unknown as Params;
    const out = await run(["look", "--", completeStr]);
    const words = out.split("\n").map((w) => w.trim()).filter((w) => w);
    const candidates = (words: string[]) => words.map((word) => ({ word }));
    const cased = p.convertCase ? convert(completeStr, words) : words;
    return candidates(cased);
  }

  params(): Record<string, unknown> {
    const params: Params = {
      convertCase: true,
    };
    return params as unknown as Record<string, unknown>;
  }
}

Deno.test("conv", function () {
  assertEquals(conv([{ v: 1, n: 2 }], "azadrachta"), "AZadrachta");
});

Deno.test("convert", function () {
  assertEquals(
    convert("AZ", [
      "az",
      "azadrachta",
      "azafrin",
      "AZ",
      "Azalea",
    ]),
    [
      "AZ",
      "AZadrachta",
      "AZafrin",
      "AZalea",
    ],
  );
});
