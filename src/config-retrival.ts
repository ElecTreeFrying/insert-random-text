
const quoteStyleEnum = [
  { value: true, description: "Single quotes" },
  { value: false, description: "Double quotes" }
]

const insertTypeEnum = [
  { value: true, description: "Cursor" },
  { value: false, description: "Top" }
]

export interface Config {
  quoteStyle:     boolean;
  insertType:     boolean;
  loremSize:      number;
  hashSize:       number;
  disableNotifs:  boolean;
  withQuote:      boolean;
  withNewLine:    boolean;
}

export const configEnum = {
  QUOTESTYLE:     'quoteStyle',
  INSERTTYPE:     'insertType',
  LOREMSIZE:      'loremSize',
  HASHSIZE:       'hashSize',
  DISABLENOTIFS:  'disableNotifs',
  WITHQUOTE:      'withQuote',
  WITHNEWLINE:    'withNewLine'
}

export class ConfigRetrival {

  private workspace: any = null;

  constructor(workspace: any) {

    this.workspace = workspace;
  }

  get param() {
    return {
      quoteStyle:     this.quoteStyle,
      insertType:     this.insertType,
      loremSize:      this.loremSize,
      hashSize:       this.hashSize,
      disableNotifs:  this.disableNotifs,
      withQuote:      this.withQuote,
      withNewLine:    this.withNewLine
    }
  }

  get quoteStyle(): boolean {
    const configValue = this.workspace.getConfiguration().get('quoteStyle');
    return quoteStyleEnum.find(e => e.description === configValue).value;
  }

  get insertType(): boolean {
    const configValue = this.workspace.getConfiguration().get('insertType');
    return insertTypeEnum.find(e => e.description === configValue).value;
  }

  get loremSize(): number { return this.workspace.getConfiguration().get('loremSize'); }
  get hashSize(): number { return this.workspace.getConfiguration().get('hashSize'); }
  get disableNotifs(): boolean { return this.workspace.getConfiguration().get('disableNotifs'); }
  get withQuote(): boolean { return this.workspace.getConfiguration().get('withQuote'); }
  get withNewLine(): boolean { return this.workspace.getConfiguration().get('withNewLine'); }

}
