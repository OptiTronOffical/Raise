"use client";
export function Segmented({ a,b,value,onChange }:{
  a:string; b:string; value:"a"|"b"; onChange:(v:"a"|"b")=>void;
}) {
  return (
    <div className="seg">
      <button className={value==="a"?"active":""} onClick={()=>onChange("a")}>{a}</button>
      <button className={value==="b"?"active":""} onClick={()=>onChange("b")}>{b}</button>
    </div>
  );
}
