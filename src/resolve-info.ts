import {
  FieldNode,
  GraphQLList,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLResolveInfo,
  GraphQLSchema,
  GraphQLType,
  isListType,
  isScalarType,
  SelectionNode,
  SelectionSetNode,
  isOutputType,
  isObjectType,
  isInterfaceType,
  isCompositeType,
  GraphQLCompositeType
} from "graphql";
import { ObjectPath } from "./ast";

export interface GraphQLJitResolveInfo extends GraphQLResolveInfo {
  fieldExpansion: FieldExpansion;
}

export interface FieldExpansion {
  [returnType: string]: TypeExpansion;
}

export interface TypeExpansion {
  [fieldName: string]: FieldExpansion | true;
}

export function createResolveInfoThunk({
  schema,
  fragments,
  operation,
  parentType,
  fieldName,
  fieldType,
  fieldNodes
}: {
  schema: GraphQLResolveInfo["schema"];
  fragments: GraphQLResolveInfo["fragments"];
  operation: GraphQLResolveInfo["operation"];
  parentType: GraphQLObjectType;
  fieldType: GraphQLOutputType;
  fieldName: string;
  fieldNodes: FieldNode[];
}) {
  const returnType = getEndReturnType(fieldType);
  const fieldExpansion: FieldExpansion = {};

  if (returnType != null) {
    for (const fieldNode of fieldNodes) {
      handleFieldNode(schema, fragments, returnType, fieldNode, fieldExpansion);
    }
  }

  return (
    rootValue: any,
    variableValues: any,
    path: ObjectPath
  ): GraphQLJitResolveInfo => ({
    fieldName,
    fieldNodes,
    returnType: fieldType,
    parentType,
    path,
    schema,
    fragments,
    rootValue,
    operation,
    variableValues,
    fieldExpansion
  });
}

function getEndReturnType(fieldType: GraphQLOutputType): string | undefined {
  if (isScalarType(fieldType)) {
    return;
  }
  if (isListType(fieldType)) {
    return getEndReturnType(fieldType.ofType);
  }
  return fieldType.name;
}

type FragmentsType = GraphQLResolveInfo["fragments"];

function handleSelectionSet(
  schema: GraphQLSchema,
  fragments: FragmentsType,
  possibleTypes: string[],
  selectionSet: SelectionSetNode,
  fieldExpansion: FieldExpansion
) {
  for (const selection of selectionSet.selections) {
    handleSelection(
      schema,
      fragments,
      possibleTypes,
      selection,
      fieldExpansion
    );
  }
}

function handleFieldNode(
  schema: GraphQLSchema,
  fragments: FragmentsType,
  returnType: string,
  node: FieldNode,
  fieldExpansion: FieldExpansion
) {
  if (node.selectionSet != null) {
    const possibleTypes = getPossibleTypes(schema, returnType);
    for (const typ of possibleTypes) {
      if (!Object.prototype.hasOwnProperty.call(fieldExpansion, typ)) {
        fieldExpansion[typ] = {};
      }
    }
    handleSelectionSet(
      schema,
      fragments,
      possibleTypes,
      node.selectionSet,
      fieldExpansion
    );
  } else {
    throw new Error("should not be called");
  }
}

function handleSelection(
  schema: GraphQLSchema,
  fragments: FragmentsType,
  possibleTypes: string[],
  node: SelectionNode,
  fieldExpansion: FieldExpansion
) {
  switch (node.kind) {
    case "Field":
      if (node.selectionSet != null) {
        const returnType = getReturnType(
          schema,
          possibleTypes[0],
          node.name.value
        );
        const nextFieldExpansion: FieldExpansion = {};
        handleFieldNode(
          schema,
          fragments,
          returnType,
          node,
          nextFieldExpansion
        );
        for (const typ of possibleTypes) {
          fieldExpansion[typ][node.name.value] = nextFieldExpansion;
        }
      } else {
        for (const typ of possibleTypes) {
          fieldExpansion[typ][node.name.value] = true;
        }
      }
      break;

    case "InlineFragment":
      handleSelectionSet(
        schema,
        fragments,
        node.typeCondition == null
          ? possibleTypes
          : [node.typeCondition.name.value],
        node.selectionSet,
        fieldExpansion
      );
      break;

    case "FragmentSpread":
      const fragment = fragments[node.name.value];
      handleSelectionSet(
        schema,
        fragments,
        [fragment.typeCondition.name.value],
        fragment.selectionSet,
        fieldExpansion
      );
      break;
  }
}

function getReturnType(
  schema: GraphQLSchema,
  parentType: string,
  fieldName: string
): string {
  const typ = schema.getType(parentType);
  if (typ == null) {
    throw new Error(`Type not found in schema ${parentType}`);
  }
  if (!(isInterfaceType(typ) || isObjectType(typ))) {
    throw new Error(
      `Field ${fieldName} selected for ${parentType} - not objectlike`
    );
  }
  const fields = typ.getFields();
  if (!Object.prototype.hasOwnProperty.call(fields, fieldName)) {
    throw new Error(`Field ${fieldName} does not exist in ${parentType}`);
  }
  const outputType = fields[fieldName].type;
  if (isListType(outputType)) {
    return resolveListType(outputType);
  }
  return outputType.name;
}

function getPossibleTypes(
  schema: GraphQLSchema,
  currentType: string
): string[] {
  const typ = schema.getType(currentType);
  if (typ == null) {
    throw new Error(`Type not found in schema "${currentType}"`);
  }
  if (!isOutputType(typ)) {
    throw new Error(`Expected GraphQL Output type. Got ${currentType}`);
  }

  const resolvedType = resolveOutputFieldType(typ);

  if (isObjectType(resolvedType)) {
    return [resolvedType.name];
  }

  const possibleTypes = schema.getPossibleTypes(resolvedType);
  const fieldTypes: string[] = [];
  if (isInterfaceType(resolvedType)) {
    fieldTypes.push(resolvedType.name);
  }
  return [...fieldTypes, ...possibleTypes.map(objectType => objectType.name)];
}

function resolveOutputFieldType(typ: GraphQLOutputType): GraphQLCompositeType {
  if (isListType(typ)) {
    return resolveOutputFieldType(typ.ofType);
  }
  if (!isCompositeType(typ)) {
    throw new Error(`Expected a Composite Type. Got ${typ.name}`);
  }

  return typ;
}

function resolveListType(typ: GraphQLType): string {
  if (isListType(typ)) {
    return resolveListType(typ.ofType);
  }

  return typ.name;
}