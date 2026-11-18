#pragma once
#include <QJsonObject>
#include <QString>
namespace mas::graphics {
struct SelectedProvider {
 QString action;
 QString providerId;
 int priority=-100000;
 bool valid() const noexcept {return !action.isEmpty();}
};
// Pure function: no discovery addresses, no application names, no cached privileges.
// Inputs must be the current authorization-filtered MAS graph.
SelectedProvider selectSvg(const QJsonObject& graph);
}
