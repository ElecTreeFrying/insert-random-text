
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
  withQuote:      boolean;
  disableNotifs:  boolean;
}

export const configEnum = {
  QUOTESTYLE:     'quoteStyle',
  INSERTTYPE:     'insertType',
  LOREMSIZE:      'loremSize',
  HASHSIZE:       'hashSize',
  WITHQUOTE:      'withQuote',
  DISABLENOTIFS:  'disableNotifs'
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
      withQuote:       this.withQuote,
      disableNotifs:  this.disableNotifs,
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
  get withQuote(): boolean { return this.workspace.getConfiguration().get('withQuote'); }
  get disableNotifs(): boolean { return this.workspace.getConfiguration().get('disableNotifs'); }

}
