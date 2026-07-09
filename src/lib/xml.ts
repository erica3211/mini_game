// XML 노드를 자바스크립트 객체(JSON)로 변환하는 재귀 함수
export function xmlToJson(xml: Node): any {
  // 1. 결과물이 담길 객체 생성
  let obj: any = {};

  // 요소(Element) 노드일 때 처리
  if (xml.nodeType === 1) { 
    const element = xml as Element;
    
    // 속성(Attributes)이 있다면 객체에 포함 (예: <item id="1"> 일 때 id 처리)
    if (element.attributes.length > 0) {
      obj["@attributes"] = {};
      for (let j = 0; j < element.attributes.length; j++) {
        const attribute = element.attributes.item(j);
        if (attribute) {
          obj["@attributes"][attribute.nodeName] = attribute.nodeValue;
        }
      }
    }
  } 
  // 텍스트 노드일 때 처리
  else if (xml.nodeType === 3) { 
    return xml.nodeValue?.trim();
  }

  // 2. 자식 노드들을 돌면서 데이터 조립
  if (xml.hasChildNodes()) {
    for (let i = 0; i < xml.childNodes.length; i++) {
      const item = xml.childNodes.item(i);
      const nodeName = item.nodeName;

      // 줄바꿈이나 공백만 있는 빈 텍스트 노드는 무시
      if (item.nodeType === 3 && !item.nodeValue?.trim()) {
        continue;
      }

      // 자식 노드를 다시 xmlToJson에 넣어서 파싱 (재귀)
      const childValue = xmlToJson(item);

      if (obj[nodeName] === undefined) {
        // 처음 발견한 태그면 그대로 넣기
        obj[nodeName] = childValue;
      } else {
        // 이미 같은 이름의 태그가 있다면 배열(Array)로 묶기 (<item>이 여러 개일 때)
        if (!Array.isArray(obj[nodeName])) {
          obj[nodeName] = [obj[nodeName]];
        }
        obj[nodeName].push(childValue);
      }
    }
  }

  // 만약 자식 노드가 단 하나이고 그게 문자열 텍스트라면, 객체 대신 문자열만 깔끔하게 리턴
  const keys = Object.keys(obj);
  if (keys.length === 1 && keys[0] === "#text") {
    return obj["#text"];
  }
  if (typeof obj === "object" && keys.length === 0) {
    return "";
  }

  return obj;
}