/**
 * Template validator implementation for Spazzatura
 * Validates template definitions, variables, and file paths
 */

import type {
  ITemplateValidator,
  Template,
  TemplateVariable,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from './types.js';

/**
 * Template validator implementation
 */
export class TemplateValidator implements ITemplateValidator {
  /**
   * Validate a template definition
   */
  validate(template: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Check if template is an object
    if (typeof template !== 'object' || template === null) {
      errors.push({
        code: 'INVALID_TYPE',
        message: 'Template must be an object',
      });
      return { valid: false, errors, warnings };
    }
    
    const t = template as Record<string, unknown>;
    
    // Validate required fields
    if (!t.name || typeof t.name !== 'string') {
      errors.push({
        code: 'MISSING_NAME',
        message: 'Template must have a "name" field of type string',
        field: 'name',
      });
    } else {
      // Validate name format
      if (!/^[a-z0-9-]+$/.test(t.name)) {
        warnings.push({
          code: 'NAME_FORMAT',
          message: 'Template name should be lowercase with hyphens (kebab-case)',
          field: 'name',
        });
      }
    }
    
    if (!t.version || typeof t.version !== 'string') {
      errors.push({
        code: 'MISSING_VERSION',
        message: 'Template must have a "version" field of type string',
        field: 'version',
      });
    } else {
      // Validate semver format
      if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(t.version)) {
        warnings.push({
          code: 'VERSION_FORMAT',
          message: 'Version should follow semver format (e.g., 1.0.0)',
          field: 'version',
        });
      }
    }
    
    // Validate files
    if (!t.files) {
      errors.push({
        code: 'MISSING_FILES',
        message: 'Template must have a "files" field',
        field: 'files',
      });
    } else if (!Array.isArray(t.files)) {
      errors.push({
        code: 'INVALID_FILES',
        message: '"files" must be an array',
        field: 'files',
      });
    } else if (t.files.length === 0) {
      warnings.push({
        code: 'EMPTY_FILES',
        message: 'Template has no files defined',
        field: 'files',
      });
    } else {
      // Validate each file
      t.files.forEach((file, index) => {
        const fileErrors = this.validateFile(file, index);
        errors.push(...fileErrors);
      });
    }
    
    // Validate variables
    if (t.variables !== undefined) {
      if (!Array.isArray(t.variables)) {
        errors.push({
          code: 'INVALID_VARIABLES',
          message: '"variables" must be an array',
          field: 'variables',
        });
      } else {
        t.variables.forEach((variable, index) => {
          const varErrors = this.validateVariableDefinition(variable, index);
          errors.push(...varErrors.errors);
          warnings.push(...varErrors.warnings);
        });
      }
    }
    
    // Validate tags
    if (t.tags !== undefined) {
      if (!Array.isArray(t.tags)) {
        errors.push({
          code: 'INVALID_TAGS',
          message: '"tags" must be an array',
          field: 'tags',
        });
      } else {
        t.tags.forEach((tag, index) => {
          if (typeof tag !== 'string') {
            errors.push({
              code: 'INVALID_TAG',
              message: `Tag at index ${index} must be a string`,
              field: `tags[${index}]`,
            });
          }
        });
      }
    }
    
    // Validate hooks
    if (t.hooks !== undefined) {
      const hookErrors = this.validateHooks(t.hooks);
      errors.push(...hookErrors);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
  
  /**
   * Validate template variables against provided values
   */
  validateVariables(
    template: Template,
    variables: Record<string, unknown>
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    if (!template.variables) {
      return { valid: true, errors, warnings };
    }
    
    for (const variable of template.variables) {
      const value = variables[variable.name];
      const result = this.validateVariableValue(variable, value);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }
    
    // Check for unknown variables
    const definedNames = new Set(template.variables.map((v) => v.name));
    for (const name of Object.keys(variables)) {
      if (!definedNames.has(name)) {
        warnings.push({
          code: 'UNKNOWN_VARIABLE',
          message: `Variable "${name}" is not defined in the template`,
          field: name,
        });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
  
  /**
   * Validate a file path
   */
  validatePath(filePath: string, variables: Record<string, unknown>): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Check for empty path
    if (!filePath || filePath.trim() === '') {
      errors.push({
        code: 'EMPTY_PATH',
        message: 'File path cannot be empty',
        field: 'path',
      });
      return { valid: false, errors, warnings };
    }
    
    // Check for path traversal
    if (filePath.includes('..')) {
      errors.push({
        code: 'PATH_TRAVERSAL',
        message: 'File path cannot contain ".." for security reasons',
        field: 'path',
        value: filePath,
      });
    }
    
    // Check for absolute paths
    if (filePath.startsWith('/') || /^[A-Za-z]:/.test(filePath)) {
      warnings.push({
        code: 'ABSOLUTE_PATH',
        message: 'File path is absolute, which may cause portability issues',
        field: 'path',
      });
    }
    
    // Check for unresolved variables
    const unresolvedVars = filePath.match(/\{\{([^}]+)\}\}/g);
    if (unresolvedVars) {
      for (const match of unresolvedVars) {
        const varName = match.slice(2, -2).trim();
        if (variables[varName] === undefined) {
          warnings.push({
            code: 'UNRESOLVED_VARIABLE',
            message: `Variable "${varName}" in path is not provided`,
            field: 'path',
          });
        }
      }
    }
    
    // Check for invalid characters
    const invalidChars = /[<>:"|?*\x00-\x1f]/;
    if (invalidChars.test(filePath)) {
      errors.push({
        code: 'INVALID_CHARACTERS',
        message: 'File path contains invalid characters',
        field: 'path',
        value: filePath,
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
  
  /**
   * Validate a single file definition
   */
  private validateFile(file: unknown, index: number): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (typeof file !== 'object' || file === null) {
      errors.push({
        code: 'INVALID_FILE',
        message: `File at index ${index} must be an object`,
        field: `files[${index}]`,
      });
      return errors;
    }
    
    const f = file as Record<string, unknown>;
    
    // Validate path
    if (!f.path || typeof f.path !== 'string') {
      errors.push({
        code: 'MISSING_PATH',
        message: `File at index ${index} must have a "path" field`,
        field: `files[${index}].path`,
      });
    }
    
    // Validate content
    if (f.content === undefined) {
      errors.push({
        code: 'MISSING_CONTENT',
        message: `File at index ${index} must have a "content" field`,
        field: `files[${index}].content`,
      });
    } else if (typeof f.content !== 'string' && typeof f.content !== 'function') {
      errors.push({
        code: 'INVALID_CONTENT',
        message: `File content at index ${index} must be a string or function`,
        field: `files[${index}].content`,
      });
    }
    
    // Validate mode
    if (f.mode !== undefined) {
      const validModes = ['create', 'overwrite', 'append', 'prepend'];
      if (!validModes.includes(f.mode as string)) {
        errors.push({
          code: 'INVALID_MODE',
          message: `Invalid mode "${f.mode}" at index ${index}. Must be one of: ${validModes.join(', ')}`,
          field: `files[${index}].mode`,
          value: f.mode,
        });
      }
    }
    
    return errors;
  }
  
  /**
   * Validate a variable definition
   */
  private validateVariableDefinition(
    variable: unknown,
    index: number
  ): { errors: ValidationError[]; warnings: ValidationWarning[] } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    if (typeof variable !== 'object' || variable === null) {
      errors.push({
        code: 'INVALID_VARIABLE',
        message: `Variable at index ${index} must be an object`,
        field: `variables[${index}]`,
      });
      return { errors, warnings };
    }
    
    const v = variable as Record<string, unknown>;
    
    // Validate name
    if (!v.name || typeof v.name !== 'string') {
      errors.push({
        code: 'MISSING_NAME',
        message: `Variable at index ${index} must have a "name" field`,
        field: `variables[${index}].name`,
      });
    } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v.name)) {
      errors.push({
        code: 'INVALID_NAME',
        message: `Variable name "${v.name}" must be a valid identifier (letters, numbers, underscores)`,
        field: `variables[${index}].name`,
        value: v.name,
      });
    }
    
    // Validate type
    const validTypes = ['string', 'number', 'boolean', 'select', 'multiselect'];
    if (v.type !== undefined && !validTypes.includes(v.type as string)) {
      errors.push({
        code: 'INVALID_TYPE',
        message: `Invalid type "${v.type}". Must be one of: ${validTypes.join(', ')}`,
        field: `variables[${index}].type`,
        value: v.type,
      });
    }
    
    // Validate options for select/multiselect
    if (v.type === 'select' || v.type === 'multiselect') {
      if (!v.options || !Array.isArray(v.options) || v.options.length === 0) {
        errors.push({
          code: 'MISSING_OPTIONS',
          message: `Variable "${v.name}" of type "${v.type}" must have options`,
          field: `variables[${index}].options`,
        });
      }
    }
    
    // Validate required
    if (v.required !== undefined && typeof v.required !== 'boolean') {
      errors.push({
        code: 'INVALID_REQUIRED',
        message: `"required" must be a boolean`,
        field: `variables[${index}].required`,
      });
    }
    
    // Validate default value type
    if (v.default !== undefined && v.type !== undefined) {
      const defaultType = typeof v.default;
      const expectedType = v.type;
      
      if (expectedType === 'string' && defaultType !== 'string') {
        warnings.push({
          code: 'DEFAULT_TYPE_MISMATCH',
          message: `Default value type (${defaultType}) doesn't match expected type (${expectedType})`,
          field: `variables[${index}].default`,
        });
      } else if (expectedType === 'number' && defaultType !== 'number') {
        warnings.push({
          code: 'DEFAULT_TYPE_MISMATCH',
          message: `Default value type (${defaultType}) doesn't match expected type (${expectedType})`,
          field: `variables[${index}].default`,
        });
      } else if (expectedType === 'boolean' && defaultType !== 'boolean') {
        warnings.push({
          code: 'DEFAULT_TYPE_MISMATCH',
          message: `Default value type (${defaultType}) doesn't match expected type (${expectedType})`,
          field: `variables[${index}].default`,
        });
      }
    }
    
    // Validate validation rules
    if (v.validation !== undefined) {
      const validationErrors = this.validateValidationRule(v.validation, index);
      errors.push(...validationErrors);
    }
    
    return { errors, warnings };
  }
  
  /**
   * Validate validation rules
   */
  private validateValidationRule(validation: unknown, varIndex: number): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (typeof validation !== 'object' || validation === null) {
      errors.push({
        code: 'INVALID_VALIDATION',
        message: `Validation rule must be an object`,
        field: `variables[${varIndex}].validation`,
      });
      return errors;
    }
    
    const v = validation as Record<string, unknown>;
    
    // Validate pattern
    if (v.pattern !== undefined) {
      try {
        new RegExp(v.pattern as string);
      } catch {
        errors.push({
          code: 'INVALID_PATTERN',
          message: `Invalid regex pattern: ${v.pattern}`,
          field: `variables[${varIndex}].validation.pattern`,
          value: v.pattern,
        });
      }
    }
    
    // Validate min/max
    if (v.min !== undefined && typeof v.min !== 'number') {
      errors.push({
        code: 'INVALID_MIN',
        message: `"min" must be a number`,
        field: `variables[${varIndex}].validation.min`,
      });
    }
    
    if (v.max !== undefined && typeof v.max !== 'number') {
      errors.push({
        code: 'INVALID_MAX',
        message: `"max" must be a number`,
        field: `variables[${varIndex}].validation.max`,
      });
    }
    
    if (typeof v.min === 'number' && typeof v.max === 'number' && v.min > v.max) {
      errors.push({
        code: 'INVALID_RANGE',
        message: `"min" (${v.min}) cannot be greater than "max" (${v.max})`,
        field: `variables[${varIndex}].validation`,
      });
    }
    
    return errors;
  }
  
  /**
   * Validate hooks
   */
  private validateHooks(hooks: unknown): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (typeof hooks !== 'object' || hooks === null) {
      errors.push({
        code: 'INVALID_HOOKS',
        message: '"hooks" must be an object',
        field: 'hooks',
      });
      return errors;
    }
    
    const validHooks = ['beforeGenerate', 'afterGenerate', 'beforeFileWrite', 'afterFileWrite'];
    const h = hooks as Record<string, unknown>;
    
    for (const [key, value] of Object.entries(h)) {
      if (!validHooks.includes(key)) {
        errors.push({
          code: 'UNKNOWN_HOOK',
          message: `Unknown hook "${key}"`,
          field: `hooks.${key}`,
        });
        continue;
      }
      
      if (typeof value !== 'function') {
        errors.push({
          code: 'INVALID_HOOK',
          message: `Hook "${key}" must be a function`,
          field: `hooks.${key}`,
        });
      }
    }
    
    return errors;
  }
  
  /**
   * Validate a variable value
   */
  private validateVariableValue(
    variable: TemplateVariable,
    value: unknown
  ): { errors: ValidationError[]; warnings: ValidationWarning[] } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Check required
    if (variable.required && (value === undefined || value === null || value === '')) {
      errors.push({
        code: 'REQUIRED',
        message: `Variable "${variable.name}" is required`,
        field: variable.name,
      });
      return { errors, warnings };
    }
    
    // Skip validation if value is not provided and not required
    if (value === undefined || value === null) {
      return { errors, warnings };
    }
    
    // Type validation
    switch (variable.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push({
            code: 'TYPE_MISMATCH',
            message: `Variable "${variable.name}" must be a string`,
            field: variable.name,
            value,
          });
        }
        break;
        
      case 'number':
        if (typeof value !== 'number' || isNaN(value as number)) {
          errors.push({
            code: 'TYPE_MISMATCH',
            message: `Variable "${variable.name}" must be a number`,
            field: variable.name,
            value,
          });
        }
        break;
        
      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push({
            code: 'TYPE_MISMATCH',
            message: `Variable "${variable.name}" must be a boolean`,
            field: variable.name,
            value,
          });
        }
        break;
        
      case 'select':
        if (variable.options) {
          const validValues = variable.options.map((o) => o.value);
          if (!validValues.includes(value as string | number | boolean)) {
            errors.push({
              code: 'INVALID_OPTION',
              message: `Variable "${variable.name}" must be one of: ${validValues.join(', ')}`,
              field: variable.name,
              value,
            });
          }
        }
        break;
        
      case 'multiselect':
        if (!Array.isArray(value)) {
          errors.push({
            code: 'TYPE_MISMATCH',
            message: `Variable "${variable.name}" must be an array`,
            field: variable.name,
            value,
          });
        } else if (variable.options) {
          const validValues = variable.options.map((o) => o.value);
          for (const item of value) {
            if (!validValues.includes(item)) {
              errors.push({
                code: 'INVALID_OPTION',
                message: `Value "${item}" is not a valid option for "${variable.name}"`,
                field: variable.name,
                value: item,
              });
            }
          }
        }
        break;
    }
    
    // Pattern validation
    if (variable.validation?.pattern && typeof value === 'string') {
      const regex = new RegExp(variable.validation.pattern);
      if (!regex.test(value)) {
        errors.push({
          code: 'PATTERN_MISMATCH',
          message: variable.validation.message ?? `Value does not match pattern: ${variable.validation.pattern}`,
          field: variable.name,
          value,
        });
      }
    }
    
    // Min/max validation for numbers
    if (typeof value === 'number') {
      if (variable.validation?.min !== undefined && value < variable.validation.min) {
        errors.push({
          code: 'MIN_VIOLATION',
          message: `Value must be at least ${variable.validation.min}`,
          field: variable.name,
          value,
        });
      }
      if (variable.validation?.max !== undefined && value > variable.validation.max) {
        errors.push({
          code: 'MAX_VIOLATION',
          message: `Value must be at most ${variable.validation.max}`,
          field: variable.name,
          value,
        });
      }
    }
    
    // Min/max validation for strings
    if (typeof value === 'string') {
      if (variable.validation?.min !== undefined && value.length < variable.validation.min) {
        errors.push({
          code: 'MIN_LENGTH',
          message: `String must be at least ${variable.validation.min} characters`,
          field: variable.name,
          value,
        });
      }
      if (variable.validation?.max !== undefined && value.length > variable.validation.max) {
        errors.push({
          code: 'MAX_LENGTH',
          message: `String must be at most ${variable.validation.max} characters`,
          field: variable.name,
          value,
        });
      }
    }
    
    return { errors, warnings };
  }
}

/**
 * Create a template validator instance
 */
export function createTemplateValidator(): ITemplateValidator {
  return new TemplateValidator();
}
