#include "svg_canvas.hpp"
#include <QColor>
#include <QEvent>
#include <QJsonObject>
#include <QPainter>
#include <QPen>
#include <QStringList>
#include <QXmlStreamReader>
#include <cmath>
namespace {
const QStringList tags={"rect","circle","ellipse","line","text"};
const QStringList attrs={"x","y","width","height","cx","cy","r","rx","ry",
 "x1","y1","x2","y2","stroke","stroke-width","fill","opacity","font-size","font-family"};
const auto ns=QStringLiteral("http://www.w3.org/2000/svg");
bool shape(QXmlStreamReader& xml,QJsonObject& output) {
 const auto tag=xml.name().toString();
 if(!tags.contains(tag)||xml.namespaceUri()!=ns)return false;
 output["type"]=tag;
 for(const auto& a:xml.attributes()) {
  const auto key=a.name().toString(),s=a.value().toString();
  if(!a.namespaceUri().isEmpty()||!attrs.contains(key))return false;
  if(key=="fill"||key=="stroke") {
   if(s!="none"&&!(s.size()==7&&s.startsWith('#')&&QColor(s).isValid()))return false;
   output[key]=s;
  }else if(key=="font-family") {
   if(s!="sans-serif")return false;
  }else{
   bool ok=false;const auto number=s.toDouble(&ok);
   if(!ok||!std::isfinite(number)||number<-8192||number>8192)return false;
   if(key=="opacity"&&(number<0||number>1))return false;
   output[key]=number;
  }
 }
 if(tag=="text") {
  const auto label=xml.readElementText(QXmlStreamReader::ErrorOnUnexpectedElement);
  if(label.size()>160)return false;
  output["text"]=label;
 }
 return !xml.hasError();
}
}
bool SvgCanvas::setSvg(const QByteArray& data) {
 if(data.isEmpty()||data.size()>110000)return false;
 QXmlStreamReader xml(data);
 QJsonArray shapes;double logicalW=512,logicalH=512;int roots=0;
 while(!xml.atEnd()) {
  xml.readNext();
  if(xml.isDTD()||xml.isProcessingInstruction())return false;
  if(!xml.isStartElement())continue;
  const auto tag=xml.name().toString();
  if(tag=="svg") {
   if(++roots!=1||xml.namespaceUri()!=ns)return false;
   for(const auto& attr:xml.attributes()) {
    const auto name=attr.name().toString();
    if(name=="width"||name=="height") {
     bool ok=false;const auto n=attr.value().toDouble(&ok);
     if(!ok||!std::isfinite(n)||n<16||n>2048)return false;
     if(name=="width")logicalW=n;else logicalH=n;
    }else if(name!="viewBox")return false;
   }
  }else if(tag=="title")xml.readElementText(QXmlStreamReader::ErrorOnUnexpectedElement);
  else {
   if(roots!=1||shapes.size()>=96)return false;
   QJsonObject item;if(!shape(xml,item))return false;shapes.append(item);
  }
 }
 if(xml.hasError()||roots!=1)return false;
 scene_=shapes;logicalWidth_=logicalW;logicalHeight_=logicalH;
 buffer_=QImage();update();return true;
}
void SvgCanvas::changeEvent(QEvent* event) {
 if(event->type()==QEvent::PaletteChange||event->type()==QEvent::StyleChange||
    event->type()==QEvent::FontChange){buffer_=QImage();update();}
 QWidget::changeEvent(event);
}
void SvgCanvas::paintEvent(QPaintEvent*) {
 if(width()<=0||height()<=0)return;
 const auto ratio=devicePixelRatioF();
 const QSize px(qRound(width()*ratio),qRound(height()*ratio));
 const bool cacheable=qint64(px.width())*px.height()<=16000000;
 if(cacheable&&(buffer_.size()!=px||buffer_.devicePixelRatio()!=ratio)){
  QImage next(px,QImage::Format_ARGB32_Premultiplied);
  if(!next.isNull()){
   next.setDevicePixelRatio(ratio);
   QPainter raster(&next);renderScene(raster);raster.end();buffer_=std::move(next);
  }
 }
 QPainter target(this);
 if(cacheable&&!buffer_.isNull())target.drawImage(QPoint(0,0),buffer_);
 else renderScene(target);
}
void SvgCanvas::renderScene(QPainter& p) {
 p.fillRect(rect(),palette().base());
 p.setRenderHint(QPainter::Antialiasing,true);
 p.scale(width()/logicalWidth_,height()/logicalHeight_);
 for(const auto& value:scene_){
  const auto item=value.toObject();
  const auto kind=item.value("type").toString();
  const auto num=[&](const char* key,double fallback=0){return item.value(key).toDouble(fallback);};
  const auto fillName=item.value("fill").toString();
  const auto fill=fillName.isEmpty()?palette().text().color():QColor(fillName);
  p.setOpacity(num("opacity",1));p.setPen(Qt::NoPen);
  p.setBrush(fillName=="none"?QBrush(Qt::NoBrush):QBrush(fill));
  if(kind=="rect")p.drawRect(QRectF(num("x"),num("y"),num("width"),num("height")));
  if(kind=="circle")p.drawEllipse(QPointF(num("cx"),num("cy")),num("r"),num("r"));
  if(kind=="ellipse")p.drawEllipse(QPointF(num("cx"),num("cy")),num("rx"),num("ry"));
  if(kind=="line"){
   const auto strokeName=item.value("stroke").toString();
   p.setPen(QPen(strokeName.isEmpty()?palette().text().color():QColor(strokeName),
    num("stroke-width",2)));
   p.drawLine(QPointF(num("x1"),num("y1")),QPointF(num("x2"),num("y2")));
  }
  if(kind=="text"){
   p.setPen(fill);auto font=p.font();font.setPixelSize(int(num("font-size",20)));
   p.setFont(font);p.drawText(QPointF(num("x"),num("y")),item.value("text").toString());
  }
 }
}
