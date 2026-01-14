import { partition } from 'lodash-es';
import SymbolFactory from '@/core/analyzer/symbol/factory';
import { CompileError, CompileErrorCode } from '@/core/errors';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, SyntaxNode,
} from '@/core/parser/nodes';
import { SyntaxToken } from '@/core/lexer/tokens';
import { ElementValidator } from '@/core/analyzer/validator/types';
import { isSimpleName, pickValidator } from '@/core/analyzer/validator/utils';
import SymbolTable from '@/core/analyzer/symbol/symbolTable';

export default class RecordsValidator implements ElementValidator {
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };
  private publicSymbolTable: SymbolTable;
  private symbolFactory: SymbolFactory;

  constructor (declarationNode: ElementDeclarationNode & { type: SyntaxToken }, publicSymbolTable: SymbolTable, symbolFactory: SymbolFactory) {
    this.declarationNode = declarationNode;
    this.publicSymbolTable = publicSymbolTable;
    this.symbolFactory = symbolFactory;
  }

  validate (): CompileError[] {
    return [...this.validateContext(), ...this.validateName(this.declarationNode.name), ...this.validateAlias(this.declarationNode.alias), ...this.validateSettingList(this.declarationNode.attributeList), ...this.validateBody(this.declarationNode.body)];
  }

  // FIXME: Validate the records are following this:
  // Records can only appear top level or inside a table
  // Inside a table, valid example:
  //   records (a,b,c) { } // only simple variables are allowed
  //   records { }
  // Outside a table, valid example:
  //   records schema.table(a,b,c) {} // must always be a call expression, with simple variables as args & the callee must be a complex/simple variable
  // Valid example:
  //   records {
  //     1,null,true,false,'b',"c",`abc`,-2,,"",NULL,TRUE,FALSE
  //     ,1,2,3
  //     2,3,4
  //     ,
  //     ,,
  //     1
  //     ""
  //   }
  // Invalid example:
  //   records {
  //     2+1,3*2+3 // we do not support complex arithmetic expression
  //   }
  private validateContext (): CompileError[] {
    return [];
  }

  private validateName (nameNode?: SyntaxNode): CompileError[] {
    return [];
  }

  private validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    return [];
  }

  private validateSettingList (settingList?: ListExpressionNode): CompileError[] {
    return [];
  }

  validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    return [];
  }

  private validateSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      sub.parent = this.declarationNode;
      if (!sub.type) {
        return [];
      }
      const _Validator = pickValidator(sub as ElementDeclarationNode & { type: SyntaxToken });
      const validator = new _Validator(sub as ElementDeclarationNode & { type: SyntaxToken }, this.publicSymbolTable, this.symbolFactory);
      return validator.validate();
    });
  }
}
