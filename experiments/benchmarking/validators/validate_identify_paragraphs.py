
def validate_identify_paragraphs_shape(obj):
    if not isinstance(obj, dict):
        raise ValueError("Top-level response is not an object")
    
    required_keys = {
        "introduction_paragraph",
        "body_paragraphs",
        "conclusion_paragraph",
        "contains_references",
        "references_section"
    }
    actual_keys = set(obj.keys())

    missing = required_keys - actual_keys
    extra = actual_keys - required_keys

    if missing:
        raise ValueError(f"Missing keys: {sorted(missing)}")
    if extra:
        raise ValueError(f"Unexpecrted keys: {sorted(extra)}")
    
    introduction = obj["introduction_paragraph"]
    body_paragraphs = obj["body_paragraphs"]
    conclusion = obj["conclusion_paragraph"]
    contains_references = obj["contains_references"]
    references_section = obj["references_section"]

    if not isinstance(introduction, str):
        raise ValueError("introduction_paragraph must be a string")
    if not isinstance(conclusion, str):
        raise ValueError("conclusion_paragraph must be a string")
    if contains_references not in {"yes", "no"}:
        raise ValueError("contains_references must be 'yes' or 'no'")
    if not isinstance(references_section, str):
        raise ValueError("references_section must be a string")
    normalized_references = references_section.strip()

    if contains_references == "yes" and not normalized_references:
        raise ValueError(
            "references_sectio must be non-empty when contains_references is 'yes'"
        )
    
    if not isinstance(body_paragraphs, dict):
        raise ValueError("body_paragraphs must be an object")
    
    if set(body_paragraphs.keys()) != {"items"}:
        raise ValueError("body_paragraphs must contain only the 'items' key.")
    
    items = body_paragraphs["items"]
    if not isinstance(items, list):
        raise ValueError("body_paragraphs.items must be an array")
    
    validated_items = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise ValueError(f"body_paragraphs,items[{index}] must be an object.")
        
        if set(item.keys()) != {"body_paragraph"}:
            raise ValueError(f"body_paragraphs,items[{index}] must contain only 'body_paragraph'")
        
        paragraph = item["body_paragraph"]
        if not isinstance(paragraph, str):
            raise ValueError(
                f"body_paragraphs,items[{index}].body_paragraph must be a string"
            )
        
        paragraph = paragraph.strip()
        if not paragraph:
            raise ValueError(
                f"body_paragraphs.items[{index}].body_paragraph must not be empty"
            )
        validated_items.append({"body_paragraph": paragraph})

    if not validated_items:
        raise ValueError("body_paragraphs.items must contain at least one body paragraph.")
    
    return {
        "introduction_paragraph": introduction.strip(),
        "body_paragraphs": { "items": validated_items },
        "conclusion_paragraph": conclusion.strip(),
        "contains_references": contains_references,
        "references_section": normalized_references,
    }