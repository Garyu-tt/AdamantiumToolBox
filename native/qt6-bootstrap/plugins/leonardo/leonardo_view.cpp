#include "interfaces.hpp"
#include "svg_canvas.hpp"
#include <QJsonArray>
#include <QJsonObject>
#include <QLabel>
#include <QMetaObject>
#include <QPlainTextEdit>
#include <QPushButton>
#include <QSpinBox>
#include <QUuid>
#include <QVBoxLayout>
class LeonardoPanel final:public QWidget {
 Q_OBJECT
public:
 LeonardoPanel(QWidget* parent,QObject* host):QWidget(parent),host_(host){
  auto* layout=new QVBoxLayout(this);
  layout->addWidget(new QLabel("Leonardo · CPU vector preview",this));
  prompt_=new QPlainTextEdit(this);prompt_->setPlaceholderText("Describe the image");
  prompt_->setMaximumHeight(100);layout->addWidget(prompt_);
  auto* sizes=new QHBoxLayout;
  width_=new QSpinBox(this);height_=new QSpinBox(this);
  for(auto* box:{width_,height_}){box->setRange(16,2048);box->setSingleStep(16);}
  width_->setValue(512);height_->setValue(320);
  sizes->addWidget(new QLabel("Width",this));sizes->addWidget(width_);
  sizes->addWidget(new QLabel("Height",this));sizes->addWidget(height_);
  layout->addLayout(sizes);
  run_=new QPushButton("Generate via Leonardo Router",this);layout->addWidget(run_);
  status_=new QLabel(this);layout->addWidget(status_);
  canvas_=new SvgCanvas(this);canvas_->setMinimumSize(280,200);layout->addWidget(canvas_,1);
  QObject::connect(run_,&QPushButton::clicked,this,&LeonardoPanel::submit);
  QObject::connect(host,SIGNAL(graphChanged(QJsonObject)),this,SLOT(sync(QJsonObject)));
  QObject::connect(host,SIGNAL(availabilityChanged(bool)),this,SLOT(online(bool)));
  QObject::connect(host,SIGNAL(invocationCompleted(QString,QJsonObject,QString)),
   this,SLOT(complete(QString,QJsonObject,QString)));
  QJsonObject graph;
  if(QMetaObject::invokeMethod(host,"graph",Qt::DirectConnection,Q_RETURN_ARG(QJsonObject,graph)))
   sync(graph);
  bool yes=false;
  if(QMetaObject::invokeMethod(host,"available",Qt::DirectConnection,Q_RETURN_ARG(bool,yes)))
   online(yes);
 }
private slots:
 void online(bool yes){online_=yes;refresh();}
 void sync(const QJsonObject& graph) {
  eligible_=false;
  for(const auto& value:graph.value("nodes").toArray()){
   const auto item=value.toObject();
   if(item.value("id").toString()=="leonardo.generate"&&item.value("type").toString()=="action")
    eligible_=true;
  }
  refresh();
 }
 void submit(){
  if(!eligible_||!online_||!pending_.isEmpty())return;
  pending_=QUuid::createUuid().toString(QUuid::WithoutBraces);
  status_->setText("Rendering...");refresh();
  const QJsonObject params{{"kind","image"},{"format","image/svg+xml"},
   {"prompt",prompt_->toPlainText()},
   {"options",QJsonObject{{"width",width_->value()},{"height",height_->value()}}}};
  const bool sent=QMetaObject::invokeMethod(host_,"invoke",Qt::DirectConnection,
   Q_ARG(QString,pending_),Q_ARG(QString,QString("leonardo.generate")),Q_ARG(QJsonObject,params));
  if(!sent){pending_.clear();status_->setText("Bridge unavailable");refresh();}
 }
 void complete(const QString& id,const QJsonObject& result,const QString& error){
  if(id!=pending_)return;
  pending_.clear();refresh();
  if(!error.isEmpty()){status_->setText(error);return;}
  const auto payload=result.value("result").toObject(),art=payload.value("artifact").toObject();
  if(payload.value("status").toString()!="completed"||
     art.value("mime").toString()!="image/svg+xml"||
     art.value("encoding").toString()!="base64"){
   status_->setText("SVG artifact unavailable");return;
  }
  const auto raw=art.value("data").toString().toLatin1();
  if(raw.size()>150000){status_->setText("Artifact too large");return;}
  const auto bytes=QByteArray::fromBase64(raw,QByteArray::AbortOnBase64DecodingErrors);
  status_->setText(canvas_->setSvg(bytes)?"Rendered · CPU cache":"Invalid SVG scene");
 }
private:
 void refresh(){
  run_->setEnabled(eligible_&&online_&&pending_.isEmpty());
  if(!online_&&pending_.isEmpty())status_->setText("Core unavailable · read-only");
 }
 QObject* host_;QPlainTextEdit* prompt_;QSpinBox *width_,*height_;
 QPushButton* run_;QLabel* status_;SvgCanvas* canvas_;
 bool online_=false,eligible_=false;QString pending_;
};
class LeonardoView final:public QObject,public INativeView {
 Q_OBJECT
 Q_PLUGIN_METADATA(IID "org.mechanicus.native.view/1.0")
 Q_INTERFACES(INativeView)
public:
 QString viewId() const override{return "leonardo.view";}
 QWidget* createView(QWidget* parent,QObject* host) override{
  return new LeonardoPanel(parent,host);
 }
};
#include "leonardo_view.moc"
