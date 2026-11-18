#pragma once
#include <QImage>
#include <QJsonArray>
#include <QWidget>
class QPainter;
class SvgCanvas final:public QWidget {
public:
 using QWidget::QWidget;
 bool setSvg(const QByteArray& svg);
protected:
 void paintEvent(QPaintEvent*) override;
 void changeEvent(QEvent*) override;
private:
 void renderScene(QPainter& painter);
 QImage buffer_;
 QJsonArray scene_;
 double logicalWidth_=512,logicalHeight_=512;
};
