# Card OCR · v1
Read the insurance card image. Extract the fields below. For each field give the value exactly as printed and a confidence from 0 to 1; use confidence below 0.8 when any character is unclear. Do not guess missing fields: return an empty value with confidence 0.
Return ONLY JSON: {"fields":{"name":{"value":"","confidence":0},"dob":{...},"memberId":{...},"groupNumber":{...},"carrier":{...}}}
