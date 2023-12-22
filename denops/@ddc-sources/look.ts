import {
  BaseSource,
  Item,
} from "https://deno.land/x/ddc_vim@v4.3.1/types.ts#^";
import { GatherArguments } from "https://deno.land/x/ddc_vim@v4.3.1/base/source.ts#^";
import { assertEquals } from "https://deno.land/std/testing/asserts.ts";

async function run(cmd: string, args: string[]): Promise<string> {
  const proc = new Deno.Command(
    cmd,
    {
      args,
      cwd: Deno.cwd(),
      stdout: "piped",
      stderr: "null",
      stdin: "null",
    },
  );

  const { stdout } = await proc.output();
  return new TextDecoder().decode(stdout);
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
  const f = (v: number, s: string) =>
    v < 0 ? s.toLowerCase() : v > 0 ? s.toUpperCase() : s;
  for (const s of series) {
    const target = word.slice(offset, offset + s.n);
    ret += f(s.v, target);
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
  dict: undefined | string;
  dflag: boolean;
  fflag: boolean;
};

function construct_args(
  q: string,
  params: Params,
  len: number,
): null | string[] {
  // https://github.com/util-linux/util-linux/blob/90eeee21c69aa805709376ad8282e68b5bd65c34/misc-utils/look.c#L137-L149
  const dflag = !params.dict || params.dflag;
  let args = [];
  if (typeof params.dict == "string") {
    if (params.dflag) args.push("-d");
    if (params.fflag) args.push("-f");
    args = args.concat(["--", q, params.dict]);
  } else {
    args = ["--", q];
  }
  if (dflag) {
    const alphanumeric = q.replace(/[^a-zA-Z0-9]/g, "");
    if (alphanumeric.length < len) {
      return null;
    }
  }
  return args;
}

export class Source extends BaseSource<Params> {
  async gather({
    sourceParams,
    sourceOptions,
    completeStr,
  }: GatherArguments<Params>): Promise<Item[]> {
    const args = construct_args(
      completeStr,
      sourceParams,
      sourceOptions.minKeywordLength,
    );
    if (!args) return [];
    const out = await run("look", args);
    const words = out.split("\n").map((w) => w.trim()).filter((w) => w);
    const items = (words: string[]) => words.map((word) => ({ word }));
    const cased = sourceParams.convertCase
      ? convert(completeStr, words)
      : words;
    return items(cased);
  }

  params(): Params {
    const params: Params = {
      convertCase: true,
      dict: undefined,
      dflag: false,
      fflag: false,
    };
    return params;
  }
}

Deno.test("conv", function () {
  assertEquals(conv([{ v: 1, n: 2 }], "azadrachta"), "AZadrachta");
  assertEquals(
    conv(
      [{ v: 1, n: 1 }, { v: -1, n: 1 }, { v: 1, n: 1 }, { v: -1, n: 2 }],
      "assemblable",
    ),
    "AsSemblable",
  );
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
  assertEquals(
    convert("AsSem", [
      "assemblable",
      "assemblage",
      "assemble",
      "assembler",
      "assembly",
      "assemblyman",
    ]),
    [
      "AsSemblable",
      "AsSemblage",
      "AsSemble",
      "AsSembler",
      "AsSembly",
      "AsSemblyman",
    ],
  );
});
